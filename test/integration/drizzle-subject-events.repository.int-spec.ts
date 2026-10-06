import type postgres from 'postgres';
import type { TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import { hashSecretKey, SECRET_KEY_PREFIX } from '../../src/domain/keys/project-keys';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleTimelineQuery } from '../../src/infra/queries/drizzle-timeline.query';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import { DrizzleProjectKeyRepository } from '../../src/infra/repositories/drizzle-project-key.repository';
import { DrizzleSubjectEventsRepository } from '../../src/infra/repositories/drizzle-subject-events.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'e7f8a9b0-c1d2-4e3f-8a4b-5c6d7e8f9a0b';
const BLOG_ID = 'f8a9b0c1-d2e3-4f4a-9b5c-6d7e8f9a0b1c';
const SIGN_UP_VISIT = 'dddddddd-0000-4000-8000-000000000001';
const APP_VISIT = 'dddddddd-0000-4000-8000-000000000002';
const OTHER_PERSON_VISIT = 'dddddddd-0000-4000-8000-000000000003';

let sequence = 0;

function event(
  sessionId: string,
  occurredAt: string,
  name: string,
  overrides: Partial<TrackedEvent> = {},
): TrackedEvent {
  sequence += 1;
  return {
    id: `eeeeeeee-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    projectId: SHOP_ID,
    name,
    occurredAt: new Date(occurredAt),
    receivedAt: new Date(occurredAt),
    sessionId,
    userId: null,
    path: '/',
    attribution: {
      referrerHost: 'duckduckgo.com',
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      fromAdClick: false,
    },
    channel: 'organic',
    deviceType: 'mobile',
    browser: 'safari',
    os: 'ios',
    country: 'BR',
    properties: {},
    ...overrides,
  };
}

const SEEDED: readonly TrackedEvent[] = [
  event(SIGN_UP_VISIT, '2026-10-04T12:00:00.000Z', 'page_view', { path: '/calculator' }),
  event(SIGN_UP_VISIT, '2026-10-04T12:03:00.000Z', 'calculator_used', {
    properties: { plan: 'mei' },
  }),
  event(SIGN_UP_VISIT, '2026-10-04T12:05:00.000Z', 'identify', { userId: 'ana' }),
  event(APP_VISIT, '2026-10-05T09:00:00.000Z', 'page_view', { userId: 'ana', path: '/app' }),
  event(OTHER_PERSON_VISIT, '2026-10-05T10:00:00.000Z', 'page_view', { userId: 'bruno' }),
  event(SIGN_UP_VISIT, '2026-10-04T12:00:00.000Z', 'page_view', { projectId: BLOG_ID }),
  event(APP_VISIT, '2026-10-05T09:00:00.000Z', 'page_view', { projectId: BLOG_ID, userId: 'ana' }),
];

describe('subject repositories against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let subjects: DrizzleSubjectEventsRepository;
  let keys: DrizzleProjectKeyRepository;
  let timeline: DrizzleTimelineQuery;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    subjects = new DrizzleSubjectEventsRepository(db);
    keys = new DrizzleProjectKeyRepository(db);
    timeline = new DrizzleTimelineQuery(db);
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO projects (id, name) VALUES (${SHOP_ID}, 'Shop'), (${BLOG_ID}, 'Blog')
    `;
    await new DrizzleEventRepository(createDrizzleDatabase(app)).insertMany(SEEDED);
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('exports the person and the anonymous visit they identified in, oldest first', async () => {
    const exported = await subjects.page(SHOP_ID, 'ana', null, 10);

    expect(exported.map((found) => found.name)).toEqual([
      'page_view',
      'calculator_used',
      'identify',
      'page_view',
    ]);
    expect(exported[1]).toEqual({
      id: 'eeeeeeee-0000-4000-8000-000000000002',
      name: 'calculator_used',
      occurredAt: new Date('2026-10-04T12:03:00.000Z'),
      sessionId: SIGN_UP_VISIT,
      path: '/',
      referrerHost: 'duckduckgo.com',
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      fromAdClick: false,
      deviceType: 'mobile',
      browser: 'safari',
      os: 'ios',
      country: 'BR',
      properties: { plan: 'mei' },
    });
  });

  it('pages after an event, by time then id', async () => {
    const first = await subjects.page(SHOP_ID, 'ana', null, 2);
    const rest = await subjects.page(SHOP_ID, 'ana', first.at(-1)?.id ?? null, 10);

    expect(rest.map((found) => found.name)).toEqual(['identify', 'page_view']);
    expect(await subjects.hasEvent(SHOP_ID, first[0]?.id ?? '')).toBe(true);
    expect(await subjects.hasEvent(BLOG_ID, first[0]?.id ?? '')).toBe(false);
  });

  it('erases only the person and their linked visit, as the application role, once', async () => {
    expect(await subjects.erase(SHOP_ID, 'ana')).toBe(4);
    expect(await subjects.erase(SHOP_ID, 'ana')).toBe(0);

    const left = await owner<{ project_id: string; user_id: string | null }[]>`
      SELECT project_id, user_id FROM events ORDER BY project_id, user_id NULLS FIRST
    `;
    expect(left).toEqual([
      { project_id: SHOP_ID, user_id: 'bruno' },
      { project_id: BLOG_ID, user_id: null },
      { project_id: BLOG_ID, user_id: 'ana' },
    ]);
    expect(await timeline.visits(SHOP_ID, { userId: 'ana' }, null, 21)).toEqual([]);
  });

  it('finds a live secret key by its hash, and nothing once revoked', async () => {
    const secret = `${SECRET_KEY_PREFIX}${'I'.repeat(32)}`;
    const created = await keys.create({
      projectId: SHOP_ID,
      kind: 'secret',
      secretHash: hashSecretKey(secret),
    });

    expect(await keys.findLiveSecret(hashSecretKey(secret))).toEqual({
      keyId: created.id,
      projectId: SHOP_ID,
      secretHash: hashSecretKey(secret),
    });

    await keys.revoke(created.id, new Date('2026-10-05T12:00:00.000Z'));

    expect(await keys.findLiveSecret(hashSecretKey(secret))).toBeNull();
  });
});

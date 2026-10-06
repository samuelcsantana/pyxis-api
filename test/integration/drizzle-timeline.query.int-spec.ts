import type postgres from 'postgres';
import type { TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleTimelineQuery } from '../../src/infra/queries/drizzle-timeline.query';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'c5d6e7f8-a9b0-4c1d-8e2f-3a4b5c6d7e8f';
const BLOG_ID = 'd6e7f8a9-b0c1-4d2e-9f3a-4b5c6d7e8f9a';
const ANONYMOUS_VISIT = 'bbbbbbbb-0000-4000-8000-000000000001';
const NEXT_DAY_VISIT = 'bbbbbbbb-0000-4000-8000-000000000002';
const STRANGER_VISIT = 'bbbbbbbb-0000-4000-8000-000000000003';
const BLOG_VISIT = 'bbbbbbbb-0000-4000-8000-000000000004';

let sequence = 0;

function event(
  sessionId: string,
  occurredAt: string,
  name: string,
  overrides: Partial<TrackedEvent> = {},
): TrackedEvent {
  sequence += 1;
  return {
    id: `cccccccc-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    projectId: SHOP_ID,
    name,
    occurredAt: new Date(occurredAt),
    receivedAt: new Date(occurredAt),
    sessionId,
    userId: null,
    path: '/',
    attribution: null,
    channel: null,
    deviceType: 'mobile',
    browser: 'safari',
    os: 'ios',
    country: 'BR',
    properties: {},
    ...overrides,
  };
}

const SEEDED: readonly TrackedEvent[] = [
  event(ANONYMOUS_VISIT, '2026-10-04T12:00:00.000Z', 'page_view', {
    path: '/calculator',
    channel: 'paid',
  }),
  event(ANONYMOUS_VISIT, '2026-10-04T12:03:00.000Z', 'calculator_used', {
    properties: { plan: 'mei' },
  }),
  event(ANONYMOUS_VISIT, '2026-10-04T12:05:00.000Z', 'signup_completed', { path: '/signup' }),
  event(ANONYMOUS_VISIT, '2026-10-04T12:05:01.000Z', 'identify', { userId: 'ana' }),
  event(NEXT_DAY_VISIT, '2026-10-05T09:00:00.000Z', 'page_view', {
    path: '/app',
    userId: 'ana',
    deviceType: 'desktop',
    browser: 'chrome',
    os: 'macos',
    country: null,
  }),
  event(STRANGER_VISIT, '2026-10-05T10:00:00.000Z', 'page_view', { userId: 'bruno' }),
  event(BLOG_VISIT, '2026-10-05T11:00:00.000Z', 'page_view', {
    projectId: BLOG_ID,
    userId: 'ana',
  }),
];

describe('DrizzleTimelineQuery against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let query: DrizzleTimelineQuery;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    query = new DrizzleTimelineQuery(db);
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO projects (id, name) VALUES (${SHOP_ID}, 'Shop'), (${BLOG_ID}, 'Blog')
    `;
    await new DrizzleEventRepository(db).insertMany(SEEDED);
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('finds every visit of a person, the anonymous one they identified in included', async () => {
    expect(await query.visits(SHOP_ID, { userId: 'ana' }, null, 21)).toEqual([
      {
        sessionId: NEXT_DAY_VISIT,
        startedAt: new Date('2026-10-05T09:00:00.000Z'),
        endedAt: new Date('2026-10-05T09:00:00.000Z'),
        deviceType: 'desktop',
        browser: 'chrome',
        os: 'macos',
        country: null,
        channel: null,
      },
      {
        sessionId: ANONYMOUS_VISIT,
        startedAt: new Date('2026-10-04T12:00:00.000Z'),
        endedAt: new Date('2026-10-04T12:05:01.000Z'),
        deviceType: 'mobile',
        browser: 'safari',
        os: 'ios',
        country: 'BR',
        channel: 'paid',
      },
    ]);
  });

  it('returns every event of the visits, the steps before the sign-in included', async () => {
    const timeline = await query.events(SHOP_ID, [ANONYMOUS_VISIT]);

    expect(timeline.map((entry) => entry.name)).toEqual([
      'page_view',
      'calculator_used',
      'signup_completed',
      'identify',
    ]);
    expect(timeline[1]).toEqual({
      id: 'cccccccc-0000-4000-8000-000000000002',
      sessionId: ANONYMOUS_VISIT,
      occurredAt: new Date('2026-10-04T12:03:00.000Z'),
      name: 'calculator_used',
      path: '/',
      properties: { plan: 'mei' },
    });
  });

  it('pages from a cursor and honors the limit', async () => {
    expect(
      (await query.visits(SHOP_ID, { userId: 'ana' }, null, 1)).map((found) => found.sessionId),
    ).toEqual([NEXT_DAY_VISIT]);
    expect(
      (
        await query.visits(SHOP_ID, { userId: 'ana' }, new Date('2026-10-05T09:00:00.000Z'), 21)
      ).map((found) => found.sessionId),
    ).toEqual([ANONYMOUS_VISIT]);
  });

  it('finds one visit by its session id', async () => {
    expect(
      (await query.visits(SHOP_ID, { sessionId: STRANGER_VISIT }, null, 21)).map(
        (found) => found.sessionId,
      ),
    ).toEqual([STRANGER_VISIT]);
  });

  it('finds nothing for an unknown person or in another project', async () => {
    expect(await query.visits(SHOP_ID, { userId: 'nobody' }, null, 21)).toEqual([]);
    expect(await query.visits(SHOP_ID, { sessionId: BLOG_VISIT }, null, 21)).toEqual([]);
    expect(await query.events(SHOP_ID, [BLOG_VISIT])).toEqual([]);
  });
});

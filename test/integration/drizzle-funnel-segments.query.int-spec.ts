import type postgres from 'postgres';
import type { TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import type { FunnelStep } from '../../src/domain/queries/funnel';
import type { QueryScope } from '../../src/domain/queries/query-scope';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleFunnelQuery } from '../../src/infra/queries/drizzle-funnel.query';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'c5d6e7f8-a9b0-4c1d-8e2f-3a4b5c6d7e8f';
const BLOG_ID = 'd6e7f8a9-b0c1-4d2e-9f3a-4b5c6d7e8f9a';

let sequence = 0;

function event(
  sessionNumber: number,
  minute: number,
  name: string,
  overrides: Partial<TrackedEvent> = {},
): TrackedEvent {
  sequence += 1;
  const at = new Date(Date.UTC(2026, 9, 5, 12, minute));
  return {
    id: `bbbbbbbb-2222-4000-8000-${String(sequence).padStart(12, '0')}`,
    projectId: SHOP_ID,
    name,
    occurredAt: at,
    receivedAt: at,
    sessionId: `cccccccc-3333-4000-8000-${String(sessionNumber).padStart(12, '0')}`,
    userId: null,
    path: '/pricing',
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

const DESKTOP = { deviceType: 'desktop', browser: 'chrome', os: 'windows' } as const;

const SEEDED: readonly TrackedEvent[] = [
  event(1, 0, 'page_view', { channel: 'paid' }),
  event(1, 1, 'signup_completed'),
  event(2, 0, 'page_view', { channel: 'organic' }),
  event(3, 0, 'page_view', { ...DESKTOP, channel: 'paid' }),
  event(3, 2, 'page_view', { ...DESKTOP, channel: 'organic' }),
  event(3, 3, 'signup_completed', DESKTOP),
  event(4, 0, 'page_view', DESKTOP),
  event(5, 0, 'signup_completed'),
  event(6, 0, 'page_view', { projectId: BLOG_ID, channel: 'paid' }),
];

const SCOPE: QueryScope = {
  projectId: SHOP_ID,
  timeZone: 'UTC',
  conversionEvent: 'signup_completed',
  range: { from: '2026-10-05', to: '2026-10-05' },
};

const SIGNUP: readonly FunnelStep[] = [
  { type: 'page', path: '/pricing' },
  { type: 'event', name: 'signup_completed' },
];

describe('DrizzleFunnelQuery segments against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let query: DrizzleFunnelQuery;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    query = new DrizzleFunnelQuery(db);
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

  it('counts the funnel per device type of the visit, the largest first', async () => {
    expect(await query.segments(SCOPE, SIGNUP, 'device')).toEqual([
      { segment: 'desktop', counts: [2, 1] },
      { segment: 'mobile', counts: [2, 1] },
    ]);
  });

  it('counts it per channel of the first attributed page view, unknown without one', async () => {
    expect(await query.segments(SCOPE, SIGNUP, 'channel')).toEqual([
      { segment: 'paid', counts: [2, 2] },
      { segment: 'organic', counts: [1, 0] },
      { segment: 'unknown', counts: [1, 0] },
    ]);
  });

  it('lists no segment when nobody reached the first step', async () => {
    expect(
      await query.segments(SCOPE, [{ type: 'page', path: '/nowhere' }, ...SIGNUP], 'device'),
    ).toEqual([]);
  });
});

import type postgres from 'postgres';
import type { Attribution, TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import type { QueryScope } from '../../src/domain/queries/query-scope';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleAcquisitionQuery } from '../../src/infra/queries/drizzle-acquisition.query';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'c9d0e1f2-a3b4-4c5d-8e6f-7a8b9c0d1e2f';
const BLOG_ID = 'd0e1f2a3-b4c5-4d6e-9f7a-8b9c0d1e2f3a';

let sequence = 0;

function event(
  sessionNumber: number,
  occurredAt: string,
  name: string,
  overrides: Partial<TrackedEvent> = {},
): TrackedEvent {
  sequence += 1;
  return {
    id: `55555555-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    projectId: SHOP_ID,
    name,
    occurredAt: new Date(occurredAt),
    receivedAt: new Date(occurredAt),
    sessionId: `66666666-0000-4000-8000-${String(sessionNumber).padStart(12, '0')}`,
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

function attribution(overrides: Partial<Attribution>): Attribution {
  return {
    referrerHost: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    fromAdClick: false,
    ...overrides,
  };
}

const AD = attribution({ utmSource: 'google', utmMedium: 'cpc', fromAdClick: true });
const SEARCH = attribution({ referrerHost: 'duckduckgo.com' });

const SEEDED: readonly TrackedEvent[] = [
  event(1, '2026-10-05T12:00:00.000Z', 'page_view', { channel: 'paid', attribution: AD }),
  event(1, '2026-10-05T12:01:00.000Z', 'page_view', { path: '/pricing' }),
  event(1, '2026-10-05T12:02:00.000Z', 'signup_completed'),
  event(2, '2026-10-06T02:30:00.000Z', 'page_view', { channel: 'paid', attribution: AD }),
  event(3, '2026-10-04T15:00:00.000Z', 'page_view', { channel: 'organic', attribution: SEARCH }),
  event(4, '2026-10-05T16:00:00.000Z', 'page_view', { channel: 'direct' }),
  event(4, '2026-10-05T16:05:00.000Z', 'page_view', { channel: 'organic', attribution: SEARCH }),
  event(5, '2026-10-05T17:00:00.000Z', 'page_view'),
  event(6, '2026-10-05T12:00:00.000Z', 'page_view', { channel: 'direct', projectId: BLOG_ID }),
];

const SCOPE: QueryScope = {
  projectId: SHOP_ID,
  timeZone: 'America/Sao_Paulo',
  conversionEvent: 'signup_completed',
  range: { from: '2026-10-04', to: '2026-10-05' },
};

describe('DrizzleAcquisitionQuery against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let query: DrizzleAcquisitionQuery;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    query = new DrizzleAcquisitionQuery(db);
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

  it('counts each session once, by the channel of its earliest entry and its local day', async () => {
    expect(await query.visitsByDayAndChannel(SCOPE)).toEqual([
      { date: '2026-10-04', channel: 'organic', visits: 1 },
      { date: '2026-10-05', channel: 'direct', visits: 1 },
      { date: '2026-10-05', channel: 'paid', visits: 2 },
    ]);
  });

  it('groups sessions by source, medium and channel, with conversions and ad clicks', async () => {
    expect(await query.sources(SCOPE, 20)).toEqual([
      {
        source: 'google',
        medium: 'cpc',
        channel: 'paid',
        visits: 2,
        conversions: 1,
        fromAdClickVisits: 2,
      },
      {
        source: '(direct)',
        medium: null,
        channel: 'direct',
        visits: 1,
        conversions: 0,
        fromAdClickVisits: 0,
      },
      {
        source: 'duckduckgo.com',
        medium: null,
        channel: 'organic',
        visits: 1,
        conversions: 0,
        fromAdClickVisits: 0,
      },
    ]);
  });

  it('honors the limit', async () => {
    expect(await query.sources(SCOPE, 1)).toHaveLength(1);
  });

  it('never counts another project', async () => {
    expect(
      await query.visitsByDayAndChannel({ ...SCOPE, projectId: BLOG_ID, timeZone: 'UTC' }),
    ).toEqual([{ date: '2026-10-05', channel: 'direct', visits: 1 }]);
  });
});

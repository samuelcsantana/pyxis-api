import type postgres from 'postgres';
import type { Attribution, TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import type { Goal, GoalTarget } from '../../src/domain/goals/goal';
import type { QueryScope } from '../../src/domain/queries/query-scope';
import { NO_REPORT_FILTERS } from '../../src/domain/queries/report-filters';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleAcquisitionQuery } from '../../src/infra/queries/drizzle-acquisition.query';
import { DrizzleFunnelQuery } from '../../src/infra/queries/drizzle-funnel.query';
import { DrizzleGoalsSummaryQuery } from '../../src/infra/queries/drizzle-goals-summary.query';
import { DrizzleOverviewQuery } from '../../src/infra/queries/drizzle-overview.query';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'e4a00000-0000-4000-8000-000000000001';
const PURCHASE: GoalTarget = { type: 'event', name: 'purchase' };
const HOME: GoalTarget = { type: 'page', path: '/' };
const SPRING_AD: Attribution = {
  referrerHost: null,
  utmSource: 'google',
  utmMedium: 'cpc',
  utmCampaign: 'spring_sale',
  fromAdClick: true,
};

let sequence = 0;

function event(
  session: number,
  occurredAt: string,
  name: string,
  overrides: Partial<TrackedEvent> = {},
): TrackedEvent {
  sequence += 1;
  return {
    id: `e4a00000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    projectId: SHOP_ID,
    name,
    occurredAt: new Date(occurredAt),
    receivedAt: new Date(occurredAt),
    sessionId: `e4a00000-0000-4000-9000-${String(session).padStart(12, '0')}`,
    userId: null,
    path: '/',
    attribution: null,
    channel: null,
    deviceType: 'desktop',
    browser: 'chrome',
    os: 'windows',
    country: 'BR',
    region: null,
    regionName: null,
    city: null,
    visitor: null,
    properties: {},
    ...overrides,
  };
}

const SEEDED: readonly TrackedEvent[] = [
  event(1, '2026-11-04T10:00:00.000Z', 'page_view', { channel: 'paid', attribution: SPRING_AD }),
  event(1, '2026-11-04T10:01:00.000Z', 'purchase', { properties: { revenue: 100 } }),
  event(1, '2026-11-04T10:05:00.000Z', 'purchase', { properties: { revenue: 29.9 } }),
  event(2, '2026-11-04T11:00:00.000Z', 'page_view', { channel: 'direct' }),
  event(2, '2026-11-04T11:01:00.000Z', 'purchase', { properties: { revenue: 'abc' } }),
  event(2, '2026-11-04T11:02:00.000Z', 'purchase', { properties: { revenue: -5 } }),
  event(2, '2026-11-04T11:03:00.000Z', 'purchase', { properties: { revenue: 5_000_000_000 } }),
  event(2, '2026-11-04T11:04:00.000Z', 'purchase'),
  event(3, '2026-11-03T09:00:00.000Z', 'page_view', { channel: 'direct' }),
  event(3, '2026-11-03T09:01:00.000Z', 'purchase', { properties: { revenue: 50 } }),
];

const SCOPE: QueryScope = {
  projectId: SHOP_ID,
  timeZone: 'UTC',
  conversion: PURCHASE,
  range: { from: '2026-11-04', to: '2026-11-04' },
  filters: NO_REPORT_FILTERS,
};

function goal(id: string, target: GoalTarget): Goal {
  return {
    id,
    projectId: SHOP_ID,
    name: id,
    target,
    position: 1,
    createdAt: new Date('2026-11-04T00:00:00.000Z'),
  };
}

describe('revenue against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let overview: DrizzleOverviewQuery;
  let goals: DrizzleGoalsSummaryQuery;
  let acquisition: DrizzleAcquisitionQuery;
  let funnel: DrizzleFunnelQuery;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    overview = new DrizzleOverviewQuery(db);
    goals = new DrizzleGoalsSummaryQuery(db);
    acquisition = new DrizzleAcquisitionQuery(db);
    funnel = new DrizzleFunnelQuery(db);
    await emptyIngestionTables(owner);
    await owner`INSERT INTO projects (id, name, timezone) VALUES (${SHOP_ID}, 'Shop', 'UTC')`;
    await new DrizzleEventRepository(db).insertMany(SEEDED);
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('sums only revenue that is a number from 0 below the bound, as a JSON number', async () => {
    const revenue = await overview.revenueTotal(SCOPE);

    expect(revenue).toBe(129.9);
    expect(typeof revenue).toBe('number');
    expect(
      await overview.revenueTotal({ ...SCOPE, range: { from: '2026-11-03', to: '2026-11-03' } }),
    ).toBe(50);
  });

  it('sums the revenue of each local day that has some', async () => {
    expect(
      await overview.revenueDays({ ...SCOPE, range: { from: '2026-11-03', to: '2026-11-04' } }),
    ).toEqual([
      { date: '2026-11-03', revenue: 50 },
      { date: '2026-11-04', revenue: 129.9 },
    ]);
  });

  it('gives each goal of the summary its revenue, nothing for a page goal', async () => {
    expect(
      await goals.countsInGoalOrder(SCOPE, [goal('purchase', PURCHASE), goal('home', HOME)]),
    ).toMatchObject({ conversions: [6, 2], revenue: [129.9, 0] });
  });

  it('gives the revenue of each source, campaign and channel to the visit that brought it', async () => {
    expect(await acquisition.sources(SCOPE, 20)).toEqual([
      expect.objectContaining({ source: '(direct)', conversions: 4, revenue: 0 }),
      expect.objectContaining({ source: 'google', conversions: 2, revenue: 129.9 }),
    ]);
    expect(await acquisition.campaigns(SCOPE, 20)).toEqual([
      expect.objectContaining({ campaign: 'spring_sale', revenue: 129.9 }),
    ]);
    expect(await acquisition.channels(SCOPE)).toEqual([
      {
        channel: 'direct',
        visits: 1,
        conversions: 4,
        convertingVisits: 1,
        fromAdClickVisits: 0,
        revenue: 0,
      },
      {
        channel: 'paid',
        visits: 1,
        conversions: 2,
        convertingVisits: 1,
        fromAdClickVisits: 1,
        revenue: 129.9,
      },
    ]);
  });

  it('gives a funnel event step the revenue of the event that completed it', async () => {
    const report = await funnel.measure(SCOPE, 'visit', [HOME, PURCHASE]);

    expect(report.steps.map(({ count, revenue }) => ({ count, revenue }))).toEqual([
      { count: 2, revenue: null },
      { count: 2, revenue: 100 },
    ]);
  });
});

import type postgres from 'postgres';
import type { TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import type { QueryScope } from '../../src/domain/queries/query-scope';
import { NO_REPORT_FILTERS } from '../../src/domain/queries/report-filters';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleOverviewQuery } from '../../src/infra/queries/drizzle-overview.query';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import {
  filteredEvent,
  filteredScope,
  MOBILE_ONLY,
  ON_A_LAPTOP,
  seedMobileAndDesktopVisits,
} from './filtered-visits';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'c1d2e3f4-a5b6-4c7d-8e9f-a0b1c2d3e4f5';

const DAY_BEFORE_FILTERED = [
  filteredEvent('f4f4f4f4-0000-4000-8000-000000000001', '2026-10-04T09:00:00.000Z', 'page_view'),
  filteredEvent('f4f4f4f4-0000-4000-8000-000000000002', '2026-10-04T09:30:00.000Z', 'page_view', {
    ...ON_A_LAPTOP,
  }),
  filteredEvent('f4f4f4f4-0000-4000-8000-000000000003', '2026-10-04T15:00:00.000Z', 'page_view'),
];
const BLOG_ID = 'd2e3f4a5-b6c7-4d8e-9fa0-b1c2d3e4f5a6';
const SESSION = {
  morning: '11111111-0000-4000-8000-000000000001',
  lateEvening: '11111111-0000-4000-8000-000000000002',
  dayBefore: '11111111-0000-4000-8000-000000000003',
  nextLocalDay: '11111111-0000-4000-8000-000000000004',
  previousPeriod: '11111111-0000-4000-8000-000000000005',
  blog: '11111111-0000-4000-8000-000000000006',
};

let sequence = 0;

function event(
  sessionId: string,
  occurredAt: string,
  name: string,
  overrides: Partial<TrackedEvent> = {},
): TrackedEvent {
  sequence += 1;
  return {
    id: `22222222-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
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
    region: null,
    regionName: null,
    city: null,
    properties: {},
    ...overrides,
  };
}

function request(sessionId: string, occurredAt: string, method: string, status: number) {
  return event(sessionId, occurredAt, 'api_request', {
    properties: { method, route: '/v1/items', status, duration_ms: 40 },
  });
}

const SEEDED: readonly TrackedEvent[] = [
  event(SESSION.morning, '2026-10-05T12:00:00.000Z', 'page_view', { path: '/' }),
  event(SESSION.morning, '2026-10-05T12:01:00.000Z', 'page_view', { path: '/pricing' }),
  event(SESSION.morning, '2026-10-05T12:02:00.000Z', 'signup_completed', { userId: 'u1' }),
  event(SESSION.morning, '2026-10-05T12:02:30.000Z', 'signup_completed', { userId: 'u1' }),
  request(SESSION.morning, '2026-10-05T12:03:00.000Z', 'POST', 201),
  request(SESSION.morning, '2026-10-05T12:04:00.000Z', 'POST', 500),
  request(SESSION.morning, '2026-10-05T12:05:00.000Z', 'GET', 500),
  event(SESSION.lateEvening, '2026-10-06T02:30:00.000Z', 'page_view', { path: '/pricing' }),
  event(SESSION.lateEvening, '2026-10-06T02:31:00.000Z', 'plan_selected'),
  request(SESSION.lateEvening, '2026-10-06T02:32:00.000Z', 'DELETE', 0),
  event(SESSION.dayBefore, '2026-10-04T15:00:00.000Z', 'page_view', { path: '/' }),
  event(SESSION.dayBefore, '2026-10-04T15:01:00.000Z', 'identify', { userId: 'u2' }),
  event(SESSION.nextLocalDay, '2026-10-06T03:30:00.000Z', 'page_view', { path: '/' }),
  event(SESSION.previousPeriod, '2026-10-02T12:00:00.000Z', 'page_view', { path: '/' }),
  event(SESSION.blog, '2026-10-05T12:00:00.000Z', 'page_view', { projectId: BLOG_ID }),
  event(SESSION.blog, '2026-10-05T12:01:00.000Z', 'signup_completed', { projectId: BLOG_ID }),
];

const SCOPE: QueryScope = {
  projectId: SHOP_ID,
  timeZone: 'America/Sao_Paulo',
  conversionEvent: 'signup_completed',
  range: { from: '2026-10-04', to: '2026-10-05' },
  filters: NO_REPORT_FILTERS,
};

describe('DrizzleOverviewQuery against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let query: DrizzleOverviewQuery;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    query = new DrizzleOverviewQuery(db);
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO projects (id, name, timezone, conversion_event)
      VALUES (${SHOP_ID}, 'Shop', 'America/Sao_Paulo', 'signup_completed'),
             (${BLOG_ID}, 'Blog', 'UTC', 'signup_completed')
    `;
    await new DrizzleEventRepository(db).insertMany(SEEDED);
    await seedMobileAndDesktopVisits(owner, db, DAY_BEFORE_FILTERED);
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('counts visits, identified users, conversions and failed writes of the range', async () => {
    expect(await query.totals(SCOPE)).toEqual({
      visits: 3,
      identifiedUsers: 2,
      conversions: 2,
      convertingVisits: 1,
      writes: 3,
      failedWrites: 2,
    });
  });

  it('counts the previous period on its own', async () => {
    expect(
      await query.totals({ ...SCOPE, range: { from: '2026-10-02', to: '2026-10-03' } }),
    ).toMatchObject({ visits: 1, conversions: 0, writes: 0 });
  });

  it('counts no conversion when the project has no conversion event', async () => {
    expect(await query.totals({ ...SCOPE, conversionEvent: null })).toMatchObject({
      conversions: 0,
      convertingVisits: 0,
    });
  });

  it('counts a visit that converted twice as one converting visit', async () => {
    expect(await query.totals(SCOPE)).toMatchObject({ conversions: 2, convertingVisits: 1 });
  });

  it('buckets by the local day: 23:30 in Sao Paulo is still that day', async () => {
    expect(await query.days(SCOPE)).toEqual([
      {
        date: '2026-10-04',
        visits: 1,
        identifiedUsers: 1,
        conversions: 0,
        convertingVisits: 0,
        writes: 0,
        failedWrites: 0,
        pageViews: 1,
        events: 0,
      },
      {
        date: '2026-10-05',
        visits: 2,
        identifiedUsers: 1,
        conversions: 2,
        convertingVisits: 1,
        writes: 3,
        failedWrites: 2,
        pageViews: 3,
        events: 3,
      },
    ]);
  });

  it('ranks pages by views and events by count, ties by name', async () => {
    expect(await query.topPages(SCOPE, 10)).toEqual([
      { path: '/', views: 2, visits: 2 },
      { path: '/pricing', views: 2, visits: 2 },
    ]);
    expect(await query.topEvents(SCOPE, 10)).toEqual([
      { name: 'signup_completed', count: 2, visits: 1 },
      { name: 'plan_selected', count: 1, visits: 1 },
    ]);
  });

  it('honors the limit', async () => {
    expect(await query.topPages(SCOPE, 1)).toHaveLength(1);
  });

  describe('when the last day of the range stops at a local time', () => {
    const dayBefore = { ...SCOPE, range: { from: '2026-10-04', to: '2026-10-04' } };

    it('leaves out what happened later that day, in the project zone', async () => {
      const untilTen = { ...dayBefore, lastDayUntil: '10:00:00.000' };

      expect(await query.totals(untilTen)).toMatchObject({ visits: 0, identifiedUsers: 0 });
      expect(await query.days(untilTen)).toEqual([]);
    });

    it('counts what happened before that time', async () => {
      const untilOne = { ...dayBefore, lastDayUntil: '13:00:00.000' };

      expect(await query.totals(untilOne)).toMatchObject({ visits: 1, identifiedUsers: 1 });
      expect(await query.days(untilOne)).toMatchObject([{ date: '2026-10-04', pageViews: 1 }]);
    });

    it('stops right before an event at exactly that time', async () => {
      const untilNoon = { ...dayBefore, lastDayUntil: '12:00:00.000' };
      const justAfterNoon = { ...dayBefore, lastDayUntil: '12:00:00.001' };

      expect((await query.totals(untilNoon)).visits).toBe(0);
      expect((await query.totals(justAfterNoon)).visits).toBe(1);
    });

    it('keeps the earlier days of the range whole', async () => {
      const untilEarlyMorning = { ...SCOPE, lastDayUntil: '01:00:00.000' };

      expect(await query.days(untilEarlyMorning)).toMatchObject([
        { date: '2026-10-04', visits: 1 },
      ]);
    });

    it('reads the time in a UTC project as UTC', async () => {
      const blogDay = {
        ...SCOPE,
        projectId: BLOG_ID,
        timeZone: 'UTC',
        range: { from: '2026-10-05', to: '2026-10-05' },
      };

      expect(await query.totals({ ...blogDay, lastDayUntil: '12:00:30.000' })).toMatchObject({
        visits: 1,
        conversions: 0,
      });
      expect(await query.totals({ ...blogDay, lastDayUntil: '12:01:30.000' })).toMatchObject({
        visits: 1,
        conversions: 1,
      });
    });
  });

  it('never counts another project, even on the same days', async () => {
    const blog = { ...SCOPE, projectId: BLOG_ID, timeZone: 'UTC' };

    expect(await query.totals(blog)).toMatchObject({ visits: 1, conversions: 1 });
    expect(await query.topEvents(blog, 10)).toEqual([
      { name: 'signup_completed', count: 1, visits: 1 },
    ]);
  });

  describe('with report filters', () => {
    it('counts only the events of the visits the filters select', async () => {
      expect(await query.totals(filteredScope())).toMatchObject({ visits: 2, writes: 2 });
      expect(await query.totals(filteredScope(MOBILE_ONLY))).toEqual({
        visits: 1,
        identifiedUsers: 0,
        conversions: 1,
        convertingVisits: 1,
        writes: 1,
        failedWrites: 1,
      });
      expect(await query.days(filteredScope(MOBILE_ONLY))).toMatchObject([
        { date: '2026-10-05', visits: 1, pageViews: 1, events: 2 },
      ]);
      expect(await query.topPages(filteredScope(MOBILE_ONLY), 10)).toEqual([
        { path: '/pricing', views: 1, visits: 1 },
      ]);
      expect(await query.topEvents(filteredScope(MOBILE_ONLY), 10)).toEqual([
        { name: 'plan_selected', count: 1, visits: 1 },
        { name: 'signup_completed', count: 1, visits: 1 },
      ]);
    });

    it('filters the previous period too, up to its cutoff', async () => {
      const dayBefore = { from: '2026-10-04', to: '2026-10-04' };
      const previousMobile = { ...filteredScope(MOBILE_ONLY), range: dayBefore };
      const untilNoon = { ...previousMobile, lastDayUntil: '12:00:00.000' };

      expect((await query.totals(previousMobile)).visits).toBe(2);
      expect((await query.totals(untilNoon)).visits).toBe(1);
      expect((await query.totals({ ...untilNoon, filters: filteredScope().filters })).visits).toBe(
        2,
      );
      expect(await query.days(untilNoon)).toMatchObject([{ date: '2026-10-04', visits: 1 }]);
    });

    it.each([
      [
        'a device and an event of the visit',
        { deviceType: 'mobile', event: { name: 'plan_selected', property: null } },
        1,
      ],
      [
        'a device and a channel the visit did not come from',
        { deviceType: 'desktop', channel: 'paid' },
        0,
      ],
      [
        'a property value of an event',
        { event: { name: 'plan_selected', property: { key: 'plan', value: 'free' } } },
        1,
      ],
      ['two pages viewed', { paths: ['/pricing', '/docs'] }, 1],
      ['three pages, one never viewed', { paths: ['/pricing', '/docs', '/nowhere'] }, 0],
      ['a page with a star', { paths: ['/pri*'] }, 2],
      ['anonymous visits, leaving out one identified at its end', { identity: 'anonymous' }, 1],
      ['identified visits', { identity: 'identified' }, 1],
      ['a browser', { browser: 'chrome' }, 1],
      ['an operating system', { os: 'ios' }, 1],
      ['a browser and a system of different visits', { browser: 'chrome', os: 'ios' }, 0],
      ['a country', { country: 'PT' }, 1],
      ['a region', { region: 'BR-SP' }, 1],
      ['a channel', { channel: 'direct' }, 1],
      ['a source', { source: 'google' }, 1],
      ['the direct source', { source: '(direct)' }, 1],
      ['a campaign', { campaign: 'spring_sale' }, 1],
      ['a failed request', { failed: true }, 1],
    ] as const)('keeps every condition, as an AND: %s', async (_case, filters, visits) => {
      expect((await query.totals(filteredScope(filters))).visits).toBe(visits);
    });
  });
});

import type postgres from 'postgres';
import type { TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import type { VisitorKind } from '../../src/domain/events/visitor-kind';
import type { QueryScope } from '../../src/domain/queries/query-scope';
import { NO_REPORT_FILTERS } from '../../src/domain/queries/report-filters';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleOverviewQuery } from '../../src/infra/queries/drizzle-overview.query';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const STORE_ID = 'a4b4c4d4-0000-4000-8000-000000000001';
const OTHER_STORE_ID = 'a4b4c4d4-0000-4000-8000-000000000002';

let sequence = 0;

function visitStart(
  visit: number,
  occurredAt: string,
  visitor: VisitorKind | null,
  overrides: Partial<TrackedEvent> = {},
): TrackedEvent {
  sequence += 1;
  return {
    id: `a5b5c5d5-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    projectId: STORE_ID,
    name: 'page_view',
    occurredAt: new Date(occurredAt),
    receivedAt: new Date(occurredAt),
    sessionId: `a6b6c6d6-0000-4000-8000-${String(visit).padStart(12, '0')}`,
    userId: null,
    path: '/',
    attribution: null,
    channel: 'direct',
    deviceType: 'mobile',
    browser: 'safari',
    os: 'ios',
    country: 'BR',
    region: null,
    regionName: null,
    city: null,
    visitor,
    properties: {},
    ...overrides,
  };
}

const ON_A_LAPTOP = { deviceType: 'desktop', browser: 'chrome', os: 'windows' } as const;

const SEEDED: readonly TrackedEvent[] = [
  visitStart(1, '2026-10-04T15:00:00.000Z', 'first_visit'),
  visitStart(1, '2026-10-04T15:01:00.000Z', null, { path: '/pricing' }),
  visitStart(2, '2026-10-05T12:00:00.000Z', 'first_this_month'),
  visitStart(3, '2026-10-05T13:00:00.000Z', 'first_today', ON_A_LAPTOP),
  visitStart(4, '2026-10-05T14:00:00.000Z', 'again_today'),
  visitStart(5, '2026-10-05T14:30:00.000Z', 'again_today'),
  visitStart(6, '2026-10-06T02:30:00.000Z', 'first_visit'),
  visitStart(7, '2026-10-06T03:30:00.000Z', 'first_visit'),
  visitStart(8, '2026-10-05T15:00:00.000Z', null, { path: '/blog' }),
  visitStart(9, '2026-10-05T16:00:00.000Z', 'first_visit'),
  visitStart(9, '2026-10-05T16:05:00.000Z', 'again_today', { name: 'plan_selected' }),
  visitStart(10, '2026-10-05T17:00:00.000Z', null),
  visitStart(10, '2026-10-05T17:02:00.000Z', 'first_today', { name: 'plan_selected' }),
  visitStart(11, '2026-10-03T12:00:00.000Z', 'first_visit'),
  visitStart(12, '2026-10-05T12:00:00.000Z', 'first_visit', { projectId: OTHER_STORE_ID }),
];

const SCOPE: QueryScope = {
  projectId: STORE_ID,
  timeZone: 'America/Sao_Paulo',
  conversion: null,
  range: { from: '2026-10-04', to: '2026-10-05' },
  filters: NO_REPORT_FILTERS,
};

describe('DrizzleOverviewQuery visitor days against a real Postgres', () => {
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
      INSERT INTO projects (id, name, timezone, visitors_enabled)
      VALUES (${STORE_ID}, 'Store', 'America/Sao_Paulo', true),
             (${OTHER_STORE_ID}, 'Other store', 'America/Sao_Paulo', true)
    `;
    await new DrizzleEventRepository(db).insertMany(SEEDED);
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('counts each kind once per visit, on the local day of the visit start', async () => {
    expect(await query.visitorDays(SCOPE)).toEqual([
      { date: '2026-10-04', firstVisit: 1, firstThisMonth: 0, firstToday: 0, againToday: 0 },
      { date: '2026-10-05', firstVisit: 2, firstThisMonth: 1, firstToday: 2, againToday: 2 },
    ]);
  });

  it('places 23:30 in Sao Paulo on that day and 00:30 on the next one', async () => {
    const nextDay = { ...SCOPE, range: { from: '2026-10-06', to: '2026-10-06' } };

    expect(await query.visitorDays(nextDay)).toEqual([
      { date: '2026-10-06', firstVisit: 1, firstThisMonth: 0, firstToday: 0, againToday: 0 },
    ]);
  });

  it('takes the kind of the earliest event of a visit that carries one', async () => {
    const plansPicked = {
      ...SCOPE,
      filters: { ...NO_REPORT_FILTERS, event: { name: 'plan_selected', property: null } },
    };

    expect(await query.visitorDays(plansPicked)).toEqual([
      { date: '2026-10-05', firstVisit: 1, firstThisMonth: 0, firstToday: 1, againToday: 0 },
    ]);
  });

  it('never counts a visit whose events carry no kind', async () => {
    const blogReaders = { ...SCOPE, filters: { ...NO_REPORT_FILTERS, paths: ['/blog'] } };

    expect(await query.visitorDays(blogReaders)).toEqual([]);
  });

  it('stops the last day at its local time', async () => {
    const lastDay = { ...SCOPE, range: { from: '2026-10-05', to: '2026-10-05' } };

    expect(await query.visitorDays({ ...lastDay, lastDayUntil: '11:30:00.000' })).toEqual([
      { date: '2026-10-05', firstVisit: 0, firstThisMonth: 1, firstToday: 1, againToday: 1 },
    ]);
    expect(await query.visitorDays({ ...lastDay, lastDayUntil: '09:00:00.000' })).toEqual([]);
  });

  it('counts only the visits the report filters select', async () => {
    const onALaptop: QueryScope = {
      ...SCOPE,
      filters: { ...NO_REPORT_FILTERS, deviceType: 'desktop' },
    };

    expect(await query.visitorDays(onALaptop)).toEqual([
      { date: '2026-10-05', firstVisit: 0, firstThisMonth: 0, firstToday: 1, againToday: 0 },
    ]);
  });

  it('answers no day when no visit of the range carries a kind', async () => {
    const quiet = { ...SCOPE, range: { from: '2026-09-01', to: '2026-09-30' } };

    expect(await query.visitorDays(quiet)).toEqual([]);
  });

  it('never counts another project, even on the same days', async () => {
    expect(await query.visitorDays({ ...SCOPE, projectId: OTHER_STORE_ID })).toEqual([
      { date: '2026-10-05', firstVisit: 1, firstThisMonth: 0, firstToday: 0, againToday: 0 },
    ]);
  });
});

import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleDemoTrafficRepository } from '../../src/infra/repositories/drizzle-demo-traffic.repository';
import { NO_REPORT_FILTERS } from '../../src/domain/queries/report-filters';
import { DrizzleOverviewQuery } from '../../src/infra/queries/drizzle-overview.query';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { GenerateDemoTrafficUseCase } from '../../src/usecases/demo-traffic/generate-demo-traffic.usecase';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const DEMO_ID = '9f0a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b01';
const NOW = new Date('2026-10-19T06:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

describe('demo traffic against a real Postgres', () => {
  jest.setTimeout(60_000);

  let owner: postgres.Sql;
  let app: postgres.Sql;
  let projects: DrizzleDemoTrafficRepository;
  let events: DrizzleEventRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    projects = new DrizzleDemoTrafficRepository(db);
    events = new DrizzleEventRepository(db);
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO projects (id, name, timezone, conversion_event, demo_traffic)
      VALUES (${DEMO_ID}, 'Demo store', 'UTC', 'signup_completed', true)
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  async function storedEvents(): Promise<number> {
    const [row] = await owner<{ count: number }[]>`
      SELECT count(*)::int AS count FROM events WHERE project_id = ${DEMO_ID}
    `;
    return row?.count ?? 0;
  }

  it('fills the project, adds nothing on a second run and only the new day after', async () => {
    const clock = new FixedClock(NOW);
    const generate = new GenerateDemoTrafficUseCase(projects, events, clock);

    const first = await generate.execute();
    const again = await generate.execute();
    clock.advanceBy(DAY_MS);
    const nextDay = await generate.execute();

    expect(first.inserted).toBeGreaterThan(5_000);
    expect(again).toEqual({ projects: 1, inserted: 0 });
    expect(nextDay.inserted).toBeGreaterThan(0);
    expect(await storedEvents()).toBe(first.inserted + nextDay.inserted);
    const [target] = await projects.targets();
    expect(target?.lastEventAt?.getTime()).toBeLessThanOrEqual(clock.now().getTime());
  });

  it('stores the conversions and the identified people the dashboard counts', async () => {
    await new GenerateDemoTrafficUseCase(projects, events, new FixedClock(NOW)).execute();

    const [row] = await owner<{ conversions: number; people: number; visits: number }[]>`
      SELECT count(*) FILTER (WHERE name = 'signup_completed')::int AS conversions,
             count(DISTINCT user_id)::int AS people,
             count(DISTINCT session_id)::int AS visits
      FROM events WHERE project_id = ${DEMO_ID}
    `;

    expect(row?.conversions).toBeGreaterThan(0);
    expect(row?.people).toBeGreaterThan(50);
    expect(row?.visits).toBeGreaterThan(90 * 25);
  });

  it('starts every visit with a kind of visitor, which the overview counts once per visit', async () => {
    await new GenerateDemoTrafficUseCase(projects, events, new FixedClock(NOW)).execute();
    const query = new DrizzleOverviewQuery(createDrizzleDatabase(app));

    const days = await query.visitorDays({
      projectId: DEMO_ID,
      timeZone: 'UTC',
      conversionEvent: 'signup_completed',
      range: { from: '2026-07-20', to: '2026-10-19' },
      filters: NO_REPORT_FILTERS,
    });
    const [row] = await owner<{ visits: number; marked: number }[]>`
      SELECT count(DISTINCT session_id)::int AS visits,
             count(*) FILTER (WHERE visitor IS NOT NULL)::int AS marked
      FROM events WHERE project_id = ${DEMO_ID}
    `;
    const counted = days.reduce(
      (sum, day) => sum + day.firstVisit + day.firstThisMonth + day.firstToday + day.againToday,
      0,
    );

    expect(row?.marked).toBe(row?.visits);
    expect(counted).toBe(row?.visits);
    expect(days.every((day) => day.firstVisit > day.againToday)).toBe(true);
  });
});

import type postgres from 'postgres';
import { RESET_LIMITS } from '../../src/domain/accounts/account-limits';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleAccountPlanLimitsRepository } from '../../src/infra/repositories/drizzle-account-plan-limits.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const ANA = 'f5f6f7f8-0000-4000-8000-000000000001';
const LARGER_ID = 'f5f6f7f8-0000-4000-8000-000000000011';
const OTHER_ID = 'f5f6f7f8-0000-4000-8000-000000000012';
const MISSING_ID = 'f5f6f7f8-0000-4000-8000-0000000000ff';

describe('setting the plan limits of an account against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let limits: DrizzleAccountPlanLimitsRepository;

  const rows = () =>
    owner<
      {
        id: string;
        events_per_month_limit: number | null;
        projects_limit: number | null;
        people_limit: number | null;
      }[]
    >`SELECT id, events_per_month_limit, projects_limit, people_limit FROM accounts ORDER BY id`;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    limits = new DrizzleAccountPlanLimitsRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`INSERT INTO admin_users (id, email) VALUES (${ANA}, 'ana@example.com')`;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status)
      VALUES (${LARGER_ID}, ${ANA}, 'active'), (${OTHER_ID}, ${ANA}, 'active')
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('starts every account on the hosted plan, with no limit of its own', async () => {
    expect(await rows()).toEqual([
      { id: LARGER_ID, events_per_month_limit: null, projects_limit: null, people_limit: null },
      { id: OTHER_ID, events_per_month_limit: null, projects_limit: null, people_limit: null },
    ]);
  });

  it('changes only the limits it is given, on that account only', async () => {
    const account = await limits.setPlanLimits(LARGER_ID, {
      eventsPerMonthLimit: 1_000_000,
      projectsLimit: 10,
    });
    await limits.setPlanLimits(LARGER_ID, { peopleLimit: 8 });

    expect(account).toMatchObject({
      id: LARGER_ID,
      eventsPerMonthLimit: 1_000_000,
      projectsLimit: 10,
      peopleLimit: null,
    });
    expect(await rows()).toEqual([
      { id: LARGER_ID, events_per_month_limit: 1_000_000, projects_limit: 10, people_limit: 8 },
      { id: OTHER_ID, events_per_month_limit: null, projects_limit: null, people_limit: null },
    ]);
  });

  it('goes back to the hosted plan on a reset', async () => {
    await limits.setPlanLimits(LARGER_ID, { projectsLimit: 10, peopleLimit: 8 });

    const account = await limits.setPlanLimits(LARGER_ID, RESET_LIMITS);

    expect(account).toMatchObject({
      eventsPerMonthLimit: null,
      projectsLimit: null,
      peopleLimit: null,
    });
  });

  it('answers nothing for an account that does not exist', async () => {
    await expect(limits.setPlanLimits(MISSING_ID, { projectsLimit: 5 })).resolves.toBeNull();
  });
});

import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleProjectAccountsQuery } from '../../src/infra/queries/drizzle-project-accounts.query';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const ANA = 'f8f9fafb-0000-4000-8000-000000000001';
const BIA = 'f8f9fafb-0000-4000-8000-000000000002';
const ANA_ACCOUNT = 'f8f9fafb-0000-4000-8000-000000000011';
const BIA_ACCOUNT = 'f8f9fafb-0000-4000-8000-000000000012';
const SHOP_ID = 'f8f9fafb-0000-4000-8000-000000000021';
const BLOG_ID = 'f8f9fafb-0000-4000-8000-000000000022';
const OPERATOR_ID = 'f8f9fafb-0000-4000-8000-000000000023';
const MISSING_ID = 'f8f9fafb-0000-4000-8000-0000000000ff';

describe('DrizzleProjectAccountsQuery against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let query: DrizzleProjectAccountsQuery;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    query = new DrizzleProjectAccountsQuery(createDrizzleDatabase(app));
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO admin_users (id, email)
      VALUES (${ANA}, 'ana@example.com'), (${BIA}, 'bia@example.com')
    `;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status)
      VALUES (${ANA_ACCOUNT}, ${ANA}, 'active'), (${BIA_ACCOUNT}, ${BIA}, 'active')
    `;
    await owner`
      INSERT INTO projects (id, name, account_id)
      VALUES (${SHOP_ID}, 'Shop', ${ANA_ACCOUNT}), (${BLOG_ID}, 'Blog', ${BIA_ACCOUNT}),
             (${OPERATOR_ID}, 'Operator', NULL)
    `;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id)
      VALUES (${ANA}, ${SHOP_ID}), (${ANA}, ${BLOG_ID}), (${ANA}, ${OPERATOR_ID})
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it("gives each project's account, a member's project and one outside any account included", async () => {
    const accounts = await query.accountsOf([SHOP_ID, BLOG_ID, OPERATOR_ID, MISSING_ID]);

    expect(accounts).toEqual(
      new Map([
        [SHOP_ID, ANA_ACCOUNT],
        [BLOG_ID, BIA_ACCOUNT],
        [OPERATOR_ID, null],
      ]),
    );
  });

  it('asks nothing for no project', async () => {
    expect(await query.accountsOf([])).toEqual(new Map());
  });
});

import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleProjectRestrictionsQuery } from '../../src/infra/queries/drizzle-project-restrictions.query';
import { DrizzleProjectSuspensionRepository } from '../../src/infra/repositories/drizzle-project-suspension.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const NOW = new Date('2026-12-01T03:00:00.000Z');
const ANA = 'f4f5f6f7-0000-4000-8000-000000000001';
const BIA = 'f4f5f6f7-0000-4000-8000-000000000002';
const ACCOUNT_ID = 'f4f5f6f7-0000-4000-8000-000000000011';
const SHOP_ID = 'f4f5f6f7-0000-4000-8000-000000000021';
const BLOG_ID = 'f4f5f6f7-0000-4000-8000-000000000022';
const OPERATOR_ID = 'f4f5f6f7-0000-4000-8000-000000000023';
const MISSING_ID = 'f4f5f6f7-0000-4000-8000-0000000000ff';

describe("suspending a project's reception against a real Postgres", () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let suspensions: DrizzleProjectSuspensionRepository;
  let restrictions: DrizzleProjectRestrictionsQuery;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const database = createDrizzleDatabase(app);
    suspensions = new DrizzleProjectSuspensionRepository(database);
    restrictions = new DrizzleProjectRestrictionsQuery(database);
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO admin_users (id, email)
      VALUES (${ANA}, 'ana@example.com'), (${BIA}, 'bia@example.com')
    `;
    await owner`INSERT INTO accounts (id, owner_admin_id, status) VALUES (${ACCOUNT_ID}, ${ANA}, 'active')`;
    await owner`
      INSERT INTO projects (id, name, account_id)
      VALUES (${SHOP_ID}, 'Shop', ${ACCOUNT_ID}), (${BLOG_ID}, 'Blog', ${ACCOUNT_ID}),
             (${OPERATOR_ID}, 'Operator', NULL)
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('suspends only that project, with the moment and the reason, as the application role', async () => {
    expect(await suspensions.suspend(SHOP_ID, 'Forged traffic', NOW)).toEqual({
      projectId: SHOP_ID,
      projectName: 'Shop',
      suspendedAt: NOW,
      reason: 'Forged traffic',
    });
    expect(await suspensions.suspensionOf(BLOG_ID)).toEqual({
      projectId: BLOG_ID,
      projectName: 'Blog',
      suspendedAt: null,
      reason: null,
    });
  });

  it('lifts the suspension and answers null for a project that does not exist', async () => {
    await suspensions.suspend(SHOP_ID, 'Forged traffic', NOW);

    expect(await suspensions.resume(SHOP_ID)).toEqual({
      projectId: SHOP_ID,
      projectName: 'Shop',
      suspendedAt: null,
      reason: null,
    });
    expect(await suspensions.suspensionOf(MISSING_ID)).toBeNull();
    expect(await suspensions.suspend(MISSING_ID, 'Forged traffic', NOW)).toBeNull();
    expect(await suspensions.resume(MISSING_ID)).toBeNull();
  });

  it("tells the reason to the account's owner only, and to nobody on the operator's projects", async () => {
    await suspensions.suspend(SHOP_ID, 'Forged traffic', NOW);
    await suspensions.suspend(OPERATOR_ID, 'Load test gone wrong', NOW);

    const forOwner = await restrictions.restrictionsOf(ANA, [SHOP_ID, BLOG_ID, OPERATOR_ID]);
    const forMember = await restrictions.restrictionsOf(BIA, [SHOP_ID]);

    expect(forOwner.get(SHOP_ID)).toEqual({
      ingestionSuspendedAt: NOW,
      ingestionSuspensionReason: 'Forged traffic',
    });
    expect(forOwner.get(BLOG_ID)).toEqual({
      ingestionSuspendedAt: null,
      ingestionSuspensionReason: null,
    });
    expect(forOwner.get(OPERATOR_ID)).toEqual({
      ingestionSuspendedAt: NOW,
      ingestionSuspensionReason: null,
    });
    expect(forMember.get(SHOP_ID)).toEqual({
      ingestionSuspendedAt: NOW,
      ingestionSuspensionReason: null,
    });
    expect(await restrictions.restrictionsOf(ANA, [])).toEqual(new Map());
  });
});

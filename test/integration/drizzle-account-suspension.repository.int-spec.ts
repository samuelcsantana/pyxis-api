import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleAccountSuspensionRepository } from '../../src/infra/repositories/drizzle-account-suspension.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const NOW = new Date('2026-12-01T03:00:00.000Z');
const ANA = 'f3f4f5f6-0000-4000-8000-000000000001';
const SUSPENDED_ID = 'f3f4f5f6-0000-4000-8000-000000000011';
const OTHER_ID = 'f3f4f5f6-0000-4000-8000-000000000012';
const MISSING_ID = 'f3f4f5f6-0000-4000-8000-0000000000ff';

describe('suspending an account against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let suspensions: DrizzleAccountSuspensionRepository;

  const marks = () =>
    owner<
      { id: string; status: string; suspended_at: Date | null; suspension_reason: string | null }[]
    >`SELECT id, status, suspended_at, suspension_reason FROM accounts ORDER BY id`;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    suspensions = new DrizzleAccountSuspensionRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`INSERT INTO admin_users (id, email) VALUES (${ANA}, 'ana@example.com')`;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status)
      VALUES (${SUSPENDED_ID}, ${ANA}, 'active'), (${OTHER_ID}, ${ANA}, 'trialing')
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('marks only that account, with the moment and the reason, keeping its status', async () => {
    const account = await suspensions.suspend(SUSPENDED_ID, 'Forged traffic', NOW);

    expect(account).toMatchObject({
      id: SUSPENDED_ID,
      status: 'active',
      suspendedAt: NOW,
      suspensionReason: 'Forged traffic',
    });
    expect(await marks()).toEqual([
      {
        id: SUSPENDED_ID,
        status: 'active',
        suspended_at: NOW,
        suspension_reason: 'Forged traffic',
      },
      { id: OTHER_ID, status: 'trialing', suspended_at: null, suspension_reason: null },
    ]);
  });

  it('lifts the mark and the reason together', async () => {
    await suspensions.suspend(SUSPENDED_ID, 'Forged traffic', NOW);

    const account = await suspensions.resume(SUSPENDED_ID);

    expect(account).toMatchObject({ suspendedAt: null, suspensionReason: null });
    expect((await marks())[0]).toMatchObject({ suspended_at: null, suspension_reason: null });
  });

  it('answers null for an account that does not exist', async () => {
    expect(await suspensions.suspend(MISSING_ID, 'Forged traffic', NOW)).toBeNull();
    expect(await suspensions.resume(MISSING_ID)).toBeNull();
  });
});

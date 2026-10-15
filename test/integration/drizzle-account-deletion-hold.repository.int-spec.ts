import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleAccountDeletionHoldRepository } from '../../src/infra/repositories/drizzle-account-deletion-hold.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const NOW = new Date('2026-12-01T03:00:00.000Z');
const ANA = 'f4f5f6f7-0000-4000-8000-000000000001';
const HELD_ID = 'f4f5f6f7-0000-4000-8000-000000000011';
const OTHER_ID = 'f4f5f6f7-0000-4000-8000-000000000012';
const MISSING_ID = 'f4f5f6f7-0000-4000-8000-0000000000ff';

describe('holding the deletion of an account against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let holds: DrizzleAccountDeletionHoldRepository;

  const marks = () =>
    owner<
      {
        id: string;
        status: string;
        deletion_held_at: Date | null;
        deletion_hold_reason: string | null;
      }[]
    >`SELECT id, status, deletion_held_at, deletion_hold_reason FROM accounts ORDER BY id`;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    holds = new DrizzleAccountDeletionHoldRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`INSERT INTO admin_users (id, email) VALUES (${ANA}, 'ana@example.com')`;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status)
      VALUES (${HELD_ID}, ${ANA}, 'ended'), (${OTHER_ID}, ${ANA}, 'active')
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('holds only that account, with the moment and the reason, keeping its status', async () => {
    const account = await holds.hold(HELD_ID, 'Court order', NOW);

    expect(account).toMatchObject({
      id: HELD_ID,
      status: 'ended',
      deletionHeldAt: NOW,
      deletionHoldReason: 'Court order',
    });
    expect(await marks()).toEqual([
      { id: HELD_ID, status: 'ended', deletion_held_at: NOW, deletion_hold_reason: 'Court order' },
      { id: OTHER_ID, status: 'active', deletion_held_at: null, deletion_hold_reason: null },
    ]);
  });

  it('releases the hold and its reason together', async () => {
    await holds.hold(HELD_ID, 'Court order', NOW);

    const account = await holds.release(HELD_ID);

    expect(account).toMatchObject({ deletionHeldAt: null, deletionHoldReason: null });
    expect((await marks())[0]).toMatchObject({
      deletion_held_at: null,
      deletion_hold_reason: null,
    });
  });

  it('answers null for an account that does not exist', async () => {
    expect(await holds.hold(MISSING_ID, 'Court order', NOW)).toBeNull();
    expect(await holds.release(MISSING_ID)).toBeNull();
  });
});

import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleAccountWelcomeRepository } from '../../src/infra/repositories/drizzle-account-welcome.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const NOW = new Date('2026-11-02T13:00:00.000Z');
const TRIAL_END = new Date('2026-11-16T13:00:00.000Z');
const ANA = 'a1a2a3a4-0000-4000-8000-000000000001';
const BIA = 'a1a2a3a4-0000-4000-8000-000000000002';
const SIGNED_UP = 'a1a2a3a4-0000-4000-8000-000000000011';
const LINKED = 'a1a2a3a4-0000-4000-8000-000000000012';
const PENDING = 'a1a2a3a4-0000-4000-8000-000000000013';

describe('welcomes against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let welcomes: DrizzleAccountWelcomeRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    welcomes = new DrizzleAccountWelcomeRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO admin_users (id, email, email_language)
      VALUES (${ANA}, 'ana@example.com', 'es'), (${BIA}, 'bia@example.com', 'en')
    `;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status, trial_ends_at)
      VALUES (${SIGNED_UP}, ${ANA}, 'trialing', ${TRIAL_END}),
             (${LINKED}, ${BIA}, 'active', NULL),
             (${PENDING}, ${BIA}, 'incomplete', NULL)
    `;
    await owner`
      INSERT INTO terms_acceptances (admin_user_id, account_id, version, accepted_at)
      VALUES (${ANA}, ${SIGNED_UP}, '2026-10-01', '2026-10-01T00:00:00Z'),
             (${ANA}, ${SIGNED_UP}, '2026-11-01', '2026-11-01T00:00:00Z'),
             (${BIA}, ${PENDING}, '2026-11-01', '2026-11-01T00:00:00Z')
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('describes an account to welcome with its owner and the latest terms accepted', async () => {
    expect(await welcomes.toWelcome(SIGNED_UP)).toEqual({
      accountId: SIGNED_UP,
      ownerEmail: 'ana@example.com',
      ownerLanguage: 'es',
      status: 'trialing',
      trialEndsAt: TRIAL_END,
      termsVersion: '2026-11-01',
    });
    expect(await welcomes.toWelcome(LINKED)).toEqual(
      expect.objectContaining({ accountId: LINKED, termsVersion: null }),
    );
  });

  it('welcomes no account without access, and none twice', async () => {
    expect(await welcomes.toWelcome(PENDING)).toBeNull();

    await welcomes.markWelcomed(SIGNED_UP, NOW);

    expect(await welcomes.toWelcome(SIGNED_UP)).toBeNull();
  });

  it('lists as pending only the signed-up accounts with access that were not welcomed', async () => {
    expect((await welcomes.pendingWelcomes()).map(({ accountId }) => accountId)).toEqual([
      SIGNED_UP,
    ]);

    await welcomes.markWelcomed(SIGNED_UP, NOW);

    expect(await welcomes.pendingWelcomes()).toEqual([]);
  });
});

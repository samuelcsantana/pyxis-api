import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleAccountRepository } from '../../src/infra/repositories/drizzle-account.repository';
import { DrizzleTermsAcceptanceRepository } from '../../src/infra/repositories/drizzle-terms-acceptance.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const OWNER_ID = 'c1a2b3c4-0000-4000-8000-000000000001';
const GUEST_ID = 'c1a2b3c4-0000-4000-8000-000000000002';
const STRANGER_ID = 'c1a2b3c4-0000-4000-8000-000000000003';
const SHOP_ID = 'c1a2b3c4-0000-4000-8000-000000000011';
const BLOG_ID = 'c1a2b3c4-0000-4000-8000-000000000012';
const OPERATOR_ID = 'c1a2b3c4-0000-4000-8000-000000000013';
const MISSING_ID = 'ffffffff-ffff-4fff-bfff-ffffffffffff';

describe('accounts against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let accounts: DrizzleAccountRepository;
  let terms: DrizzleTermsAcceptanceRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    accounts = new DrizzleAccountRepository(db);
    terms = new DrizzleTermsAcceptanceRepository(db);
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO admin_users (id, email)
      VALUES (${OWNER_ID}, 'owner@example.com'), (${GUEST_ID}, 'guest@example.com'),
             (${STRANGER_ID}, 'stranger@example.com')
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('creates an account for its owner, as the application role, and finds it by id', async () => {
    const created = await accounts.create({ ownerAdminId: OWNER_ID, status: 'comped' });

    expect(created).toEqual({
      id: expect.any(String) as string,
      ownerAdminId: OWNER_ID,
      status: 'comped',
      ingestionPausedUntil: null,
      stripeCustomerId: null,
      billingInterval: null,
      trialEndsAt: null,
      currentPeriodEndsAt: null,
      accessEndsAt: null,
      suspendedAt: null,
      suspensionReason: null,
      deletionHeldAt: null,
      deletionHoldReason: null,
      createdAt: expect.any(Date) as Date,
    });
    expect(await accounts.findById(created.id)).toEqual(created);
    expect(await accounts.findById(MISSING_ID)).toBeNull();
  });

  it('refuses a status outside the lifecycle', async () => {
    await expect(
      owner`INSERT INTO accounts (owner_admin_id, status) VALUES (${OWNER_ID}, 'free')`,
    ).rejects.toThrow(/accounts_status_check/);
  });

  it('lists the projects of an account, oldest first, and counts the people who read them', async () => {
    const account = await accounts.create({ ownerAdminId: OWNER_ID, status: 'comped' });
    await owner`
      INSERT INTO projects (id, name, account_id, created_at)
      VALUES (${BLOG_ID}, 'Blog', ${account.id}, '2026-10-14T12:00:00Z'),
             (${SHOP_ID}, 'Shop', ${account.id}, '2026-10-14T10:00:00Z'),
             (${OPERATOR_ID}, 'Operator', NULL, '2026-10-14T09:00:00Z')
    `;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id)
      VALUES (${OWNER_ID}, ${SHOP_ID}), (${OWNER_ID}, ${BLOG_ID}), (${GUEST_ID}, ${BLOG_ID}),
             (${STRANGER_ID}, ${OPERATOR_ID})
    `;

    expect((await accounts.projectsOf(account.id)).map(({ name }) => name)).toEqual([
      'Shop',
      'Blog',
    ]);
    expect(await accounts.peopleCount(account.id)).toBe(2);
  });

  it('gives the overview of an account with its owner e-mail, and none for an unknown id', async () => {
    const account = await accounts.create({ ownerAdminId: OWNER_ID, status: 'comped' });
    await owner`INSERT INTO projects (id, name, account_id) VALUES (${SHOP_ID}, 'Shop', ${account.id})`;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id) VALUES (${OWNER_ID}, ${SHOP_ID})
    `;

    const overview = await accounts.overviewOf(account.id);

    expect(overview).toEqual({
      account,
      ownerEmail: 'owner@example.com',
      projects: [expect.objectContaining({ id: SHOP_ID, name: 'Shop' })],
      people: 1,
    });
    expect(await accounts.overviewOf(MISSING_ID)).toBeNull();
  });

  it('has no projects and no people for an account without projects', async () => {
    const account = await accounts.create({ ownerAdminId: OWNER_ID, status: 'comped' });

    expect(await accounts.projectsOf(account.id)).toEqual([]);
    expect(await accounts.peopleCount(account.id)).toBe(0);
  });

  it("finds an owner's newest account that has not ended, and none without one", async () => {
    const ended = await accounts.create({ ownerAdminId: OWNER_ID, status: 'ended' });

    expect(await accounts.liveAccountOwnedBy(OWNER_ID)).toBeNull();

    await owner`UPDATE accounts SET created_at = '2026-10-01T00:00:00Z' WHERE id = ${ended.id}`;
    const older = await accounts.create({ ownerAdminId: OWNER_ID, status: 'active' });
    await owner`UPDATE accounts SET created_at = '2026-10-02T00:00:00Z' WHERE id = ${older.id}`;
    const newest = await accounts.create({ ownerAdminId: OWNER_ID, status: 'incomplete' });

    expect(await accounts.liveAccountOwnedBy(OWNER_ID)).toEqual(newest);
    expect(await accounts.liveAccountOwnedBy(STRANGER_ID)).toBeNull();
  });

  it('lists the accounts an admin owns, then those whose projects they read, each once', async () => {
    const owned = await accounts.create({ ownerAdminId: OWNER_ID, status: 'trialing' });
    const guests = await accounts.create({ ownerAdminId: GUEST_ID, status: 'active' });
    await owner`
      INSERT INTO projects (id, name, account_id)
      VALUES (${SHOP_ID}, 'Shop', ${owned.id}), (${BLOG_ID}, 'Blog', ${owned.id}),
             (${OPERATOR_ID}, 'Operator', NULL)
    `;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id)
      VALUES (${OWNER_ID}, ${SHOP_ID}), (${GUEST_ID}, ${SHOP_ID}), (${GUEST_ID}, ${BLOG_ID}),
             (${GUEST_ID}, ${OPERATOR_ID})
    `;

    expect(await accounts.membershipsOf(OWNER_ID)).toEqual([{ account: owned, role: 'owner' }]);
    expect(await accounts.membershipsOf(GUEST_ID)).toEqual([
      { account: guests, role: 'owner' },
      { account: owned, role: 'member' },
    ]);
    expect(await accounts.membershipsOf(STRANGER_ID)).toEqual([]);
  });

  it('records each acceptance of the terms, as the application role, gone with its account', async () => {
    const account = await accounts.create({ ownerAdminId: OWNER_ID, status: 'incomplete' });
    const acceptedAt = new Date('2026-11-02T13:00:00.000Z');

    await terms.record({
      adminUserId: OWNER_ID,
      accountId: account.id,
      version: '2026-11-01',
      acceptedAt,
    });
    await terms.record({
      adminUserId: OWNER_ID,
      accountId: account.id,
      version: '2026-11-01',
      acceptedAt,
    });

    const rows = await owner<{ version: string; accepted_at: Date }[]>`
      SELECT version, accepted_at FROM terms_acceptances WHERE account_id = ${account.id}
    `;
    expect(rows).toEqual([
      { version: '2026-11-01', accepted_at: acceptedAt },
      { version: '2026-11-01', accepted_at: acceptedAt },
    ]);
    await owner`DELETE FROM accounts WHERE id = ${account.id}`;
    expect(await owner`SELECT 1 FROM terms_acceptances`).toHaveLength(0);
  });

  it('keeps an account while it has projects, and its owner while it exists', async () => {
    const account = await accounts.create({ ownerAdminId: OWNER_ID, status: 'comped' });
    await owner`INSERT INTO projects (id, name, account_id) VALUES (${SHOP_ID}, 'Shop', ${account.id})`;

    await expect(owner`DELETE FROM accounts WHERE id = ${account.id}`).rejects.toThrow(
      /projects_account_id_accounts_id_fk/,
    );
    await expect(owner`DELETE FROM admin_users WHERE id = ${OWNER_ID}`).rejects.toThrow(
      /accounts_owner_admin_id_admin_users_id_fk/,
    );
  });
});

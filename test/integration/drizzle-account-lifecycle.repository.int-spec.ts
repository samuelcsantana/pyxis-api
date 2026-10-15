import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleAccountLifecycleRepository } from '../../src/infra/repositories/drizzle-account-lifecycle.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const NOW = new Date('2026-12-01T03:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const ANA = 'f1f2f3f4-0000-4000-8000-000000000001';
const BIA = 'f1f2f3f4-0000-4000-8000-000000000002';
const CARLA = 'f1f2f3f4-0000-4000-8000-000000000003';
const DORA = 'f1f2f3f4-0000-4000-8000-000000000004';
const ENDED_ID = 'f1f2f3f4-0000-4000-8000-000000000011';
const ACTIVE_ID = 'f1f2f3f4-0000-4000-8000-000000000012';
const INCOMPLETE_ID = 'f1f2f3f4-0000-4000-8000-000000000013';
const SHOP_ID = 'f1f2f3f4-0000-4000-8000-000000000021';
const BLOG_ID = 'f1f2f3f4-0000-4000-8000-000000000022';
const OTHER_ID = 'f1f2f3f4-0000-4000-8000-000000000023';

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

describe('the account lifecycle against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let lifecycle: DrizzleAccountLifecycleRepository;

  const seedEvents = (projectId: string, count: number) => owner`
    INSERT INTO events (id, project_id, occurred_at, received_at, name, session_id, path,
                        device_type, browser, os)
    SELECT gen_random_uuid(), ${projectId}, ${NOW}, ${NOW}, 'page_view', gen_random_uuid(), '/',
           'desktop', 'chrome', 'windows'
    FROM generate_series(1, ${count})
  `;

  const setEnded = (accessEndsAt: Date, marks = '') =>
    owner.unsafe(
      `UPDATE accounts SET status = 'ended', access_ends_at = $1${marks} WHERE id = $2`,
      [accessEndsAt.toISOString(), ENDED_ID],
    );

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    lifecycle = new DrizzleAccountLifecycleRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO admin_users (id, email, email_language)
      VALUES (${ANA}, 'ana@example.com', 'pt-BR'), (${BIA}, 'bia@example.com', 'en'),
             (${CARLA}, 'carla@example.com', 'en'), (${DORA}, 'dora@example.com', 'en')
    `;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status, stripe_subscription_id, created_at)
      VALUES (${ENDED_ID}, ${ANA}, 'active', 'sub_ended', ${daysAgo(60)}),
             (${ACTIVE_ID}, ${CARLA}, 'active', 'sub_active', ${daysAgo(60)}),
             (${INCOMPLETE_ID}, ${DORA}, 'incomplete', NULL, ${daysAgo(8)})
    `;
    await owner`
      INSERT INTO projects (id, name, account_id)
      VALUES (${SHOP_ID}, 'Shop', ${ENDED_ID}), (${BLOG_ID}, 'Blog', ${ENDED_ID}),
             (${OTHER_ID}, 'Other', ${ACTIVE_ID})
    `;
    await owner`
      INSERT INTO project_keys (project_id, kind, public_key)
      VALUES (${SHOP_ID}, 'public', ${`pyxis_pk_${'S'.repeat(32)}`}),
             (${OTHER_ID}, 'public', ${`pyxis_pk_${'O'.repeat(32)}`})
    `;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id)
      VALUES (${ANA}, ${SHOP_ID}), (${ANA}, ${BLOG_ID}), (${BIA}, ${SHOP_ID}),
             (${BIA}, ${OTHER_ID}), (${CARLA}, ${OTHER_ID})
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('lists the subscribed accounts that still have access, as the application role', async () => {
    await setEnded(daysAgo(1));

    expect(await lifecycle.reconcilable()).toEqual([
      { accountId: ACTIVE_ID, status: 'active', accessEndsAt: null, subscriptionId: 'sub_active' },
    ]);
  });

  it("revokes the keys of an ended account's projects once its access is over, once", async () => {
    await setEnded(daysAgo(1));

    expect(await lifecycle.revokeKeysOfEndedAccounts(NOW)).toBe(1);
    expect(await lifecycle.revokeKeysOfEndedAccounts(NOW)).toBe(0);
    const keys = await owner<{ project_id: string; revoked: boolean }[]>`
      SELECT project_id, revoked_at IS NOT NULL AS revoked FROM project_keys ORDER BY project_id
    `;
    expect(keys).toEqual([
      { project_id: SHOP_ID, revoked: true },
      { project_id: OTHER_ID, revoked: false },
    ]);
  });

  it('waits for the end of access before revoking anything', async () => {
    await setEnded(new Date(NOW.getTime() + DAY_MS));

    expect(await lifecycle.revokeKeysOfEndedAccounts(NOW)).toBe(0);
  });

  it('finds the ended accounts to notify, with their owner, until they are marked', async () => {
    await setEnded(daysAgo(2));

    expect(await lifecycle.endedToNotify(NOW)).toEqual([
      {
        accountId: ENDED_ID,
        ownerAdminId: ANA,
        ownerEmail: 'ana@example.com',
        ownerLanguage: 'pt-BR',
        accessEndsAt: daysAgo(2),
      },
    ]);
    await lifecycle.markEndedNotified(ENDED_ID, NOW);
    expect(await lifecycle.endedToNotify(NOW)).toEqual([]);
  });

  it('finds the accounts to remind inside the last seven days only, until they are marked', async () => {
    const remindBefore = daysAgo(23);
    const deleteBefore = daysAgo(30);
    await setEnded(daysAgo(10));
    expect(await lifecycle.dueForReminder(remindBefore, deleteBefore)).toEqual([]);

    await setEnded(daysAgo(24));
    expect((await lifecycle.dueForReminder(remindBefore, deleteBefore)).length).toBe(1);
    await lifecycle.markReminded(ENDED_ID, NOW);
    expect(await lifecycle.dueForReminder(remindBefore, deleteBefore)).toEqual([]);

    await setEnded(daysAgo(31), ', deletion_reminded_at = NULL');
    expect(await lifecycle.dueForReminder(remindBefore, deleteBefore)).toEqual([]);
    expect(
      (await lifecycle.dueForDeletion(deleteBefore)).map(({ accountId }) => accountId),
    ).toEqual([ENDED_ID]);
  });

  it('finds the abandoned sign-ups: incomplete, never subscribed, old and without projects', async () => {
    expect(await lifecycle.staleIncomplete(daysAgo(7))).toEqual([
      { accountId: INCOMPLETE_ID, ownerAdminId: DORA },
    ]);
    expect(await lifecycle.staleIncomplete(daysAgo(9))).toEqual([]);
    await owner`UPDATE accounts SET stripe_subscription_id = 'sub_pending' WHERE id = ${INCOMPLETE_ID}`;
    expect(await lifecycle.staleIncomplete(daysAgo(7))).toEqual([]);
  });

  it('lists the people and the projects of an account', async () => {
    expect([...(await lifecycle.peopleOf(ENDED_ID))].sort()).toEqual([ANA, BIA].sort());
    expect([...(await lifecycle.projectIdsOf(ENDED_ID))].sort()).toEqual([SHOP_ID, BLOG_ID].sort());
  });

  it('deletes events in batches, then the projects, the account and the people left with nothing', async () => {
    await seedEvents(SHOP_ID, 7);
    await seedEvents(OTHER_ID, 2);
    await owner`
      INSERT INTO terms_acceptances (admin_user_id, account_id, version, accepted_at)
      VALUES (${ANA}, ${ENDED_ID}, '2026-11-01', ${NOW})
    `;

    expect(await lifecycle.deleteEventsOf(SHOP_ID, 3)).toBe(3);
    expect(await lifecycle.deleteEventsOf(SHOP_ID, 3)).toBe(3);
    expect(await lifecycle.deleteEventsOf(SHOP_ID, 3)).toBe(1);
    await lifecycle.deleteProject(SHOP_ID);
    await lifecycle.deleteProject(BLOG_ID);
    await lifecycle.deleteAccount(ENDED_ID);

    expect(await lifecycle.deleteAdminsLeftWithout([])).toBe(0);
    expect(await lifecycle.deleteAdminsLeftWithout([ANA, BIA, CARLA, DORA])).toBe(1);
    const admins = await owner<{ email: string }[]>`SELECT email FROM admin_users ORDER BY email`;
    expect(admins.map(({ email }) => email)).toEqual([
      'bia@example.com',
      'carla@example.com',
      'dora@example.com',
    ]);
    expect(await owner`SELECT 1 FROM events WHERE project_id = ${OTHER_ID}`).toHaveLength(2);
    expect(await owner`SELECT 1 FROM project_keys WHERE project_id = ${SHOP_ID}`).toHaveLength(0);
    expect(await owner`SELECT 1 FROM terms_acceptances`).toHaveLength(0);
  });
});

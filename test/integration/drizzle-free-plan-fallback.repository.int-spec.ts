import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleFreePlanFallbackRepository } from '../../src/infra/repositories/drizzle-free-plan-fallback.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const AT = new Date('2026-12-21T12:00:00.000Z');
const ANA = 'c1c2c3c4-0000-4000-8000-000000000001';
const BIA = 'c1c2c3c4-0000-4000-8000-000000000002';
const GUEST = 'c1c2c3c4-0000-4000-8000-000000000003';
const ENDING = 'c1c2c3c4-0000-4000-8000-000000000011';
const CLOSED = 'c1c2c3c4-0000-4000-8000-000000000012';
const BIAS_FREE = 'c1c2c3c4-0000-4000-8000-000000000013';
const BIAS_PAID = 'c1c2c3c4-0000-4000-8000-000000000014';
const MISSING = 'c1c2c3c4-0000-4000-8000-000000000099';
const ALIAS_OF_ANA = 'c1c2c3c4-0000-4000-8000-000000000004';
const ALIAS_FREE = 'c1c2c3c4-0000-4000-8000-000000000015';
const SHOP = 'c1c2c3c4-0000-4000-8000-000000000021';
const BLOG = 'c1c2c3c4-0000-4000-8000-000000000022';

interface StoredAccount {
  readonly status: string;
  readonly stripe_customer_id: string | null;
  readonly stripe_subscription_id: string | null;
  readonly current_period_ends_at: Date | null;
  readonly access_ends_at: Date | null;
  readonly back_to_free_notice_due_at: Date | null;
  readonly free_since: Date | null;
}

describe('the fall back to the free plan against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let fallbacks: DrizzleFreePlanFallbackRepository;

  const stored = async (accountId: string): Promise<StoredAccount | undefined> => {
    const [row] = await owner<StoredAccount[]>`
      SELECT status, stripe_customer_id, stripe_subscription_id, current_period_ends_at,
             access_ends_at, back_to_free_notice_due_at, free_since
      FROM accounts WHERE id = ${accountId}
    `;
    return row;
  };

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    fallbacks = new DrizzleFreePlanFallbackRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO admin_users (id, email, email_language)
      VALUES (${ANA}, 'ana@example.com', 'pt-BR'), (${BIA}, 'bia@example.com', 'en'),
             (${GUEST}, 'guest@example.com', 'en')
    `;
    await owner`
      INSERT INTO accounts (
        id, owner_admin_id, status, stripe_customer_id, stripe_subscription_id,
        current_period_ends_at, projects_limit, events_per_month_limit
      )
      VALUES (${ENDING}, ${ANA}, 'ending', 'cus_ana', 'sub_ana', ${AT}, 2, 20000),
             (${CLOSED}, ${ANA}, 'ended', 'cus_closed', NULL, NULL, NULL, NULL),
             (${BIAS_FREE}, ${BIA}, 'free', NULL, NULL, NULL, NULL, NULL),
             (${BIAS_PAID}, ${BIA}, 'active', 'cus_bia', 'sub_bia', ${AT}, NULL, NULL)
    `;
    await owner`
      INSERT INTO projects (id, name, account_id)
      VALUES (${SHOP}, 'Shop', ${ENDING}), (${BLOG}, 'Blog', ${ENDING})
    `;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id)
      VALUES (${ANA}, ${SHOP}), (${ANA}, ${BLOG}), (${GUEST}, ${BLOG})
    `;
    await owner`
      INSERT INTO terms_acceptances (admin_user_id, account_id, version, accepted_at)
      VALUES (${ANA}, ${ENDING}, '1.2', '2026-10-01T00:00:00Z'),
             (${ANA}, ${ENDING}, '1.3', '2026-11-16T00:00:00Z')
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('measures an account against the free plan: its projects, its people, its limits and its terms', async () => {
    expect(await fallbacks.fitOf(ENDING)).toEqual({
      eventsPerMonthLimit: 20000,
      projectsLimit: 2,
      peopleLimit: null,
      projects: 2,
      people: 2,
      acceptedTermsVersions: expect.arrayContaining(['1.2', '1.3']) as unknown,
      ownerHasAnotherFreeAccount: false,
    });
  });

  it('says when the owner already has another free account, and knows no missing account', async () => {
    expect(await fallbacks.fitOf(BIAS_PAID)).toMatchObject({
      projects: 0,
      people: 0,
      acceptedTermsVersions: [],
      ownerHasAnotherFreeAccount: true,
    });
    expect(await fallbacks.fitOf(MISSING)).toBeNull();
  });

  it('counts a free account of another address of the same mailbox as another free account', async () => {
    await owner`
      INSERT INTO admin_users (id, email) VALUES (${ALIAS_OF_ANA}, 'ana+news@example.com')
    `;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status) VALUES (${ALIAS_FREE}, ${ALIAS_OF_ANA}, 'free')
    `;

    expect(await fallbacks.fitOf(ENDING)).toMatchObject({ ownerHasAnotherFreeAccount: true });
    expect(await fallbacks.mailboxHasAnotherFreeAccount(ENDING)).toBe(true);
    expect(await fallbacks.mailboxHasAnotherFreeAccount(ALIAS_FREE)).toBe(false);
  });

  it('says whether the mailbox of an account has another free account, and says no for a missing one', async () => {
    expect(await fallbacks.mailboxHasAnotherFreeAccount(BIAS_PAID)).toBe(true);
    expect(await fallbacks.mailboxHasAnotherFreeAccount(BIAS_FREE)).toBe(false);
    expect(await fallbacks.mailboxHasAnotherFreeAccount(ENDING)).toBe(false);
    expect(await fallbacks.mailboxHasAnotherFreeAccount(MISSING)).toBe(false);
  });

  it('puts a running subscription back on free, keeping the customer and marking the notice', async () => {
    expect(await fallbacks.fallBack(ENDING, AT)).toBe(true);

    expect(await stored(ENDING)).toEqual({
      status: 'free',
      stripe_customer_id: 'cus_ana',
      stripe_subscription_id: null,
      current_period_ends_at: null,
      access_ends_at: null,
      back_to_free_notice_due_at: AT,
      free_since: AT,
    });
  });

  it('leaves an account that is no longer running, such as one closed meanwhile', async () => {
    expect(await fallbacks.fallBack(CLOSED, AT)).toBe(false);

    expect((await stored(CLOSED))?.status).toBe('ended');
  });

  it('lists the free accounts due the notice with their owner, and clears the mark once sent', async () => {
    await fallbacks.fallBack(ENDING, AT);

    const target = {
      accountId: ENDING,
      ownerEmail: 'ana@example.com',
      ownerLanguage: 'pt-BR',
      eventsPerMonthLimit: 20000,
    };
    expect(await fallbacks.pendingNotices()).toEqual([target]);
    expect(await fallbacks.toNotify(ENDING)).toEqual(target);
    expect(await fallbacks.toNotify(BIAS_FREE)).toBeNull();

    await fallbacks.markNotified(ENDING);

    expect(await fallbacks.pendingNotices()).toEqual([]);
  });

  it('lists the free accounts whose deadline to fit has come, with their fit', async () => {
    await owner`
      UPDATE accounts SET status = 'free', free_plan_fit_due_at = ${AT} WHERE id = ${ENDING}
    `;
    await owner`
      UPDATE accounts SET free_plan_fit_due_at = ${new Date(AT.getTime() + 1)} WHERE id = ${BIAS_FREE}
    `;

    const due = await fallbacks.fitDeadlinesDue(AT);

    expect(due.map(({ accountId }) => accountId)).toEqual([ENDING]);
    expect(due[0]?.fit).toMatchObject({ projects: 2, people: 2, projectsLimit: 2 });
  });

  it('clears a deadline once the account fits, and ends one that still does not', async () => {
    await owner`
      UPDATE accounts SET status = 'free', free_plan_fit_due_at = ${AT}
      WHERE id IN (${ENDING}, ${BIAS_FREE})
    `;

    await fallbacks.clearFitDeadline(BIAS_FREE);
    await fallbacks.endUnfit(ENDING, AT);

    const rows = await owner<{ id: string; status: string; access_ends_at: Date | null }[]>`
      SELECT id, status, access_ends_at, free_plan_fit_due_at FROM accounts
      WHERE id IN (${ENDING}, ${BIAS_FREE}) ORDER BY id
    `;
    expect(rows).toEqual([
      { id: ENDING, status: 'ended', access_ends_at: AT, free_plan_fit_due_at: null },
      { id: BIAS_FREE, status: 'free', access_ends_at: null, free_plan_fit_due_at: null },
    ]);
  });

  it('never ends an account that is no longer free on its deadline', async () => {
    await owner`UPDATE accounts SET free_plan_fit_due_at = ${AT} WHERE id = ${BIAS_PAID}`;

    await fallbacks.endUnfit(BIAS_PAID, AT);

    expect((await stored(BIAS_PAID))?.status).toBe('active');
  });

  it('never notifies an account that left the free plan before the notice went', async () => {
    await fallbacks.fallBack(ENDING, AT);
    await owner`UPDATE accounts SET status = 'ended' WHERE id = ${ENDING}`;

    expect(await fallbacks.pendingNotices()).toEqual([]);
  });
});

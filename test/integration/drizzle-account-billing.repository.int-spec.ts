import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import {
  DrizzleAccountBillingRepository,
  DrizzleBillingEventRepository,
} from '../../src/infra/repositories/drizzle-account-billing.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const OWNER_ID = 'f1f2f3f4-0000-4000-8000-000000000001';
const ACCOUNT_ID = 'f1f2f3f4-0000-4000-8000-000000000011';
const OTHER_ID = 'f1f2f3f4-0000-4000-8000-000000000012';
const NOW = new Date('2026-10-20T12:00:00.000Z');
const TRIAL_END = new Date('2026-11-03T12:00:00.000Z');
const NO_IDS = { accountId: null, subscriptionId: null, customerId: null };

describe('account billing and billing events against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let accounts: DrizzleAccountBillingRepository;
  let events: DrizzleBillingEventRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    accounts = new DrizzleAccountBillingRepository(db);
    events = new DrizzleBillingEventRepository(db);
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`INSERT INTO admin_users (id, email) VALUES (${OWNER_ID}, 'owner@example.com')`;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status)
      VALUES (${ACCOUNT_ID}, ${OWNER_ID}, 'incomplete'), (${OTHER_ID}, ${OWNER_ID}, 'comped')
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('puts a subscription on the account, then finds the account by its Stripe ids', async () => {
    await accounts.apply(ACCOUNT_ID, {
      status: 'trialing',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      billingInterval: 'month',
      trialEndsAt: TRIAL_END,
      currentPeriodEndsAt: TRIAL_END,
      accessEndsAt: null,
      restoresAccess: true,
    });

    const expected = { accountId: ACCOUNT_ID, status: 'trialing', accessEndsAt: null };
    expect(await accounts.find({ ...NO_IDS, accountId: ACCOUNT_ID })).toEqual(expected);
    expect(await accounts.find({ ...NO_IDS, subscriptionId: 'sub_1' })).toEqual(expected);
    expect(await accounts.find({ ...NO_IDS, customerId: 'cus_1' })).toEqual(expected);
    const [row] = await owner<{ billing_interval: string; trial_ends_at: Date }[]>`
      SELECT billing_interval, trial_ends_at FROM accounts WHERE id = ${ACCOUNT_ID}
    `;
    expect(row).toEqual({ billing_interval: 'month', trial_ends_at: TRIAL_END });
  });

  it('finds nothing without an id, for unknown ids, or for an account id that is not a UUID', async () => {
    expect(await accounts.find(NO_IDS)).toBeNull();
    expect(await accounts.find({ ...NO_IDS, customerId: 'cus_unknown' })).toBeNull();
    expect(await accounts.find({ ...NO_IDS, accountId: 'not-a-uuid' })).toBeNull();
  });

  it('keeps each Stripe customer and subscription on one account only', async () => {
    const update = {
      status: 'active' as const,
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      billingInterval: null,
      trialEndsAt: null,
      currentPeriodEndsAt: null,
      accessEndsAt: null,
      restoresAccess: true,
    };
    await accounts.apply(ACCOUNT_ID, update);

    await expect(accounts.apply(OTHER_ID, update)).rejects.toThrow();
  });

  it('clears the end-of-access marks when the account regains access, and keeps them otherwise', async () => {
    const marked = new Date('2026-10-01T00:00:00.000Z');
    const marks = () => owner<
      {
        keys_revoked_at: Date | null;
        ended_notified_at: Date | null;
        deletion_reminded_at: Date | null;
      }[]
    >`
      SELECT keys_revoked_at, ended_notified_at, deletion_reminded_at FROM accounts
      WHERE id = ${ACCOUNT_ID}
    `;
    await owner`
      UPDATE accounts
      SET keys_revoked_at = ${marked}, ended_notified_at = ${marked}, deletion_reminded_at = ${marked}
      WHERE id = ${ACCOUNT_ID}
    `;
    const ended = {
      status: 'ended' as const,
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      billingInterval: null,
      trialEndsAt: null,
      currentPeriodEndsAt: null,
      accessEndsAt: marked,
      restoresAccess: false,
    };

    await accounts.apply(ACCOUNT_ID, ended);
    expect(await marks()).toEqual([
      { keys_revoked_at: marked, ended_notified_at: marked, deletion_reminded_at: marked },
    ]);

    await accounts.apply(ACCOUNT_ID, {
      ...ended,
      status: 'active',
      accessEndsAt: null,
      restoresAccess: true,
    });
    expect(await marks()).toEqual([
      { keys_revoked_at: null, ended_notified_at: null, deletion_reminded_at: null },
    ]);
  });

  it('claims an event until it is completed, and never after', async () => {
    const event = { id: 'evt_1', type: 'invoice.paid' };

    expect(await events.claim(event, NOW)).toBe(true);
    expect(await events.claim(event, NOW)).toBe(true);
    await events.complete('evt_1', NOW);
    expect(await events.claim(event, NOW)).toBe(false);
    const rows = await owner<{ type: string; processed: boolean }[]>`
      SELECT type, processed_at IS NOT NULL AS processed FROM billing_events
    `;
    expect(rows).toEqual([{ type: 'invoice.paid', processed: true }]);
  });
});

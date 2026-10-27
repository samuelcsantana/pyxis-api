import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleAccountWithdrawalRepository } from '../../src/infra/repositories/drizzle-account-withdrawal.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const OWNER_ID = 'c9c8c7c6-0000-4000-8000-000000000001';
const ACCOUNT_ID = 'c9c8c7c6-0000-4000-8000-000000000011';
const MISSING_ID = 'ffffffff-ffff-4fff-bfff-ffffffffffff';
const AT = new Date('2026-11-20T15:00:00.000Z');

describe('withdrawals against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let withdrawals: DrizzleAccountWithdrawalRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    withdrawals = new DrizzleAccountWithdrawalRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`INSERT INTO admin_users (id, email) VALUES (${OWNER_ID}, 'owner@example.com')`;
    await owner`
      INSERT INTO accounts (
        id, owner_admin_id, status, stripe_customer_id, stripe_subscription_id, billing_interval,
        current_period_ends_at, access_ends_at, keys_revoked_at, ended_notified_at,
        subscription_confirmation_due_at
      )
      VALUES (
        ${ACCOUNT_ID}, ${OWNER_ID}, 'ended', 'cus_1', 'sub_1', 'month',
        '2026-12-18T00:00:00Z', ${AT}, ${AT}, ${AT}, ${AT}
      )
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it("reads the account's subscription, and nothing for an account it does not know", async () => {
    expect(await withdrawals.subscriptionOf(ACCOUNT_ID)).toBe('sub_1');
    expect(await withdrawals.subscriptionOf(MISSING_ID)).toBeNull();
  });

  it('puts the account back on the free plan, keeping the Stripe customer and clearing the rest', async () => {
    await withdrawals.returnToFreePlan(ACCOUNT_ID, null);

    const [account] = await owner`
      SELECT status, stripe_customer_id, stripe_subscription_id, billing_interval,
             current_period_ends_at, access_ends_at, keys_revoked_at, ended_notified_at,
             subscription_confirmation_due_at, free_plan_fit_due_at
      FROM accounts WHERE id = ${ACCOUNT_ID}
    `;
    expect(account).toEqual({
      status: 'free',
      stripe_customer_id: 'cus_1',
      stripe_subscription_id: null,
      billing_interval: null,
      current_period_ends_at: null,
      access_ends_at: null,
      keys_revoked_at: null,
      ended_notified_at: null,
      subscription_confirmation_due_at: null,
      free_plan_fit_due_at: null,
    });
  });

  it('marks the day an account over the free plan must fit by', async () => {
    const fitBy = new Date('2026-12-20T15:00:00.000Z');

    await withdrawals.returnToFreePlan(ACCOUNT_ID, fitBy);

    const [account] = await owner`
      SELECT status, free_plan_fit_due_at FROM accounts WHERE id = ${ACCOUNT_ID}
    `;
    expect(account).toEqual({ status: 'free', free_plan_fit_due_at: fitBy });
  });
});

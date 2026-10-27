import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleSubscriptionConfirmationRepository } from '../../src/infra/repositories/drizzle-subscription-confirmation.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const DUE_AT = new Date('2026-11-20T12:00:00.000Z');
const ANA = 'b1b2b3b4-0000-4000-8000-000000000001';
const BIA = 'b1b2b3b4-0000-4000-8000-000000000002';
const PAYING = 'b1b2b3b4-0000-4000-8000-000000000011';
const LONG_PAYING = 'b1b2b3b4-0000-4000-8000-000000000012';
const WITHDRAWN = 'b1b2b3b4-0000-4000-8000-000000000013';

describe('subscription confirmations against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let confirmations: DrizzleSubscriptionConfirmationRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    confirmations = new DrizzleSubscriptionConfirmationRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO admin_users (id, email, email_language)
      VALUES (${ANA}, 'ana@example.com', 'es'), (${BIA}, 'bia@example.com', 'en')
    `;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status, billing_interval, subscription_confirmation_due_at)
      VALUES (${PAYING}, ${ANA}, 'active', 'year', ${DUE_AT}),
             (${LONG_PAYING}, ${BIA}, 'active', 'month', NULL),
             (${WITHDRAWN}, ${BIA}, 'free', NULL, ${DUE_AT})
    `;
    await owner`
      INSERT INTO terms_acceptances (admin_user_id, account_id, version, accepted_at)
      VALUES (${ANA}, ${PAYING}, '1.2', '2026-10-01T00:00:00Z'),
             (${ANA}, ${PAYING}, '1.3', '2026-11-16T00:00:00Z')
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('describes a subscription due its confirmation with its owner, interval and latest terms', async () => {
    expect(await confirmations.toConfirm(PAYING)).toEqual({
      accountId: PAYING,
      ownerEmail: 'ana@example.com',
      ownerLanguage: 'es',
      billingInterval: 'year',
      termsVersion: '1.3',
    });
  });

  it('lists only the paying accounts marked due, never a customer from before nor a free account', async () => {
    expect((await confirmations.pendingConfirmations()).map(({ accountId }) => accountId)).toEqual([
      PAYING,
    ]);
    expect(await confirmations.toConfirm(LONG_PAYING)).toBeNull();
    expect(await confirmations.toConfirm(WITHDRAWN)).toBeNull();
  });

  it('clears the mark once confirmed', async () => {
    await confirmations.markConfirmed(PAYING);

    expect(await confirmations.pendingConfirmations()).toEqual([]);
  });
});

import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleAccountClosureRepository } from '../../src/infra/repositories/drizzle-account-closure.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const NOW = new Date('2026-12-01T03:00:00.000Z');
const EARLIER = new Date('2026-11-01T03:00:00.000Z');
const ANA = 'f2f3f4f5-0000-4000-8000-000000000001';
const BIA = 'f2f3f4f5-0000-4000-8000-000000000002';
const CLOSING_ID = 'f2f3f4f5-0000-4000-8000-000000000011';
const OTHER_ACCOUNT_ID = 'f2f3f4f5-0000-4000-8000-000000000012';
const COMPED_ID = 'f2f3f4f5-0000-4000-8000-000000000013';
const SHOP_ID = 'f2f3f4f5-0000-4000-8000-000000000021';
const BLOG_ID = 'f2f3f4f5-0000-4000-8000-000000000022';
const OTHER_ID = 'f2f3f4f5-0000-4000-8000-000000000023';

describe('closing an account against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let closure: DrizzleAccountClosureRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    closure = new DrizzleAccountClosureRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO admin_users (id, email, email_language)
      VALUES (${ANA}, 'ana@example.com', 'pt-BR'), (${BIA}, 'bia@example.com', 'en')
    `;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status, stripe_subscription_id, created_at)
      VALUES (${CLOSING_ID}, ${ANA}, 'active', 'sub_closing', ${EARLIER}),
             (${OTHER_ACCOUNT_ID}, ${BIA}, 'active', 'sub_other', ${EARLIER}),
             (${COMPED_ID}, ${BIA}, 'comped', NULL, ${EARLIER})
    `;
    await owner`
      INSERT INTO projects (id, name, account_id)
      VALUES (${SHOP_ID}, 'Shop', ${CLOSING_ID}), (${BLOG_ID}, 'Blog', ${CLOSING_ID}),
             (${OTHER_ID}, 'Other', ${OTHER_ACCOUNT_ID})
    `;
    await owner`
      INSERT INTO project_keys (project_id, kind, public_key, revoked_at)
      VALUES (${SHOP_ID}, 'public', ${`pyxis_pk_${'S'.repeat(32)}`}, NULL),
             (${BLOG_ID}, 'public', ${`pyxis_pk_${'B'.repeat(32)}`}, NULL),
             (${BLOG_ID}, 'public', ${`pyxis_pk_${'R'.repeat(32)}`}, ${EARLIER}),
             (${OTHER_ID}, 'public', ${`pyxis_pk_${'O'.repeat(32)}`}, NULL)
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it("reads an account's Stripe subscription, or nothing, as the application role", async () => {
    expect(await closure.subscriptionOf(CLOSING_ID)).toBe('sub_closing');
    expect(await closure.subscriptionOf(COMPED_ID)).toBeNull();
    expect(await closure.subscriptionOf('f2f3f4f5-0000-4000-8000-0000000000ff')).toBeNull();
  });

  it('ends the account now and revokes the live keys of its projects only', async () => {
    await closure.close(CLOSING_ID, NOW);

    const [account] = await owner<
      { status: string; access_ends_at: Date; keys_revoked_at: Date }[]
    >`SELECT status, access_ends_at, keys_revoked_at FROM accounts WHERE id = ${CLOSING_ID}`;
    expect(account).toEqual({ status: 'ended', access_ends_at: NOW, keys_revoked_at: NOW });
    const keys = await owner<{ public_key: string; revoked_at: Date | null }[]>`
      SELECT public_key, revoked_at FROM project_keys ORDER BY public_key
    `;
    expect(keys).toEqual([
      { public_key: `pyxis_pk_${'B'.repeat(32)}`, revoked_at: NOW },
      { public_key: `pyxis_pk_${'O'.repeat(32)}`, revoked_at: null },
      { public_key: `pyxis_pk_${'R'.repeat(32)}`, revoked_at: EARLIER },
      { public_key: `pyxis_pk_${'S'.repeat(32)}`, revoked_at: NOW },
    ]);
    const [other] = await owner<{ status: string }[]>`
      SELECT status FROM accounts WHERE id = ${OTHER_ACCOUNT_ID}
    `;
    expect(other).toEqual({ status: 'active' });
  });

  it('marks the ended notice as sent', async () => {
    await closure.markEndedNotified(CLOSING_ID, NOW);

    const [account] = await owner<{ ended_notified_at: Date }[]>`
      SELECT ended_notified_at FROM accounts WHERE id = ${CLOSING_ID}
    `;
    expect(account).toEqual({ ended_notified_at: NOW });
  });
});

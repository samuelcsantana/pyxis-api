import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleTrialCardRepository } from '../../src/infra/repositories/drizzle-trial-card.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const FIRST_ACCOUNT = 'f5f6f7f8-0000-4000-8000-000000000011';
const SECOND_ACCOUNT = 'f5f6f7f8-0000-4000-8000-000000000012';
const THIRD_ACCOUNT = 'f5f6f7f8-0000-4000-8000-000000000013';
const EARLY = new Date('2026-09-01T12:00:00.000Z');
const LATER = new Date('2026-10-20T12:00:00.000Z');

describe('trial cards against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let cards: DrizzleTrialCardRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    cards = new DrizzleTrialCardRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('records a card once per account, keeping the first date it started a trial', async () => {
    expect(
      await cards.record({ fingerprint: 'fp_1', accountId: FIRST_ACCOUNT, trialStartedAt: EARLY }),
    ).toBe(true);
    expect(
      await cards.record({ fingerprint: 'fp_1', accountId: FIRST_ACCOUNT, trialStartedAt: LATER }),
    ).toBe(false);

    const rows = await owner<{ account_id: string; trial_started_at: Date }[]>`
      SELECT account_id, trial_started_at FROM trial_cards WHERE fingerprint = 'fp_1'
    `;
    expect(rows).toEqual([{ account_id: FIRST_ACCOUNT, trial_started_at: EARLY }]);
  });

  it('names the other accounts whose trial used the same card, earliest first', async () => {
    await cards.record({ fingerprint: 'fp_1', accountId: SECOND_ACCOUNT, trialStartedAt: LATER });
    await cards.record({ fingerprint: 'fp_1', accountId: FIRST_ACCOUNT, trialStartedAt: EARLY });
    await cards.record({ fingerprint: 'fp_2', accountId: THIRD_ACCOUNT, trialStartedAt: EARLY });

    expect(await cards.otherAccountIds('fp_1', THIRD_ACCOUNT)).toEqual([
      FIRST_ACCOUNT,
      SECOND_ACCOUNT,
    ]);
    expect(await cards.otherAccountIds('fp_1', FIRST_ACCOUNT)).toEqual([SECOND_ACCOUNT]);
    expect(await cards.otherAccountIds('fp_2', THIRD_ACCOUNT)).toEqual([]);
  });

  it('keeps a card for an account that no longer exists', async () => {
    expect(
      await cards.record({ fingerprint: 'fp_3', accountId: FIRST_ACCOUNT, trialStartedAt: EARLY }),
    ).toBe(true);

    const [account] = await owner<{ count: number }[]>`
      SELECT count(*)::int AS count FROM accounts WHERE id = ${FIRST_ACCOUNT}
    `;
    expect(account).toEqual({ count: 0 });
    expect(await cards.otherAccountIds('fp_3', SECOND_ACCOUNT)).toEqual([FIRST_ACCOUNT]);
  });
});

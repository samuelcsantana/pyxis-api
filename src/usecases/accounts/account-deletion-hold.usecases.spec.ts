import { AccountNotFoundError } from '../../domain/errors/account.errors';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAccountRepository } from '../../test-utils/in-memory-account.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { HoldAccountDeletionUseCase } from './hold-account-deletion.usecase';
import { ReleaseAccountDeletionUseCase } from './release-account-deletion.usecase';

const NOW = new Date('2026-11-03T12:00:00.000Z');
const LATER = new Date('2026-11-04T09:00:00.000Z');
const OWNER_ID = 'ad000000-0000-4000-a000-000000000001';
const MISSING_ID = 'ffffffff-ffff-4fff-bfff-ffffffffffff';

async function setup() {
  const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
  const clock = new FixedClock(NOW);
  const account = await accounts.create({ ownerAdminId: OWNER_ID, status: 'ended' });
  return {
    accounts,
    clock,
    account,
    hold: new HoldAccountDeletionUseCase(accounts, accounts, clock),
    release: new ReleaseAccountDeletionUseCase(accounts),
  };
}

describe('HoldAccountDeletionUseCase', () => {
  it('holds the deletion now, with the reason, and leaves the status alone', async () => {
    const { hold, accounts, account } = await setup();

    const held = await hold.execute({ accountId: account.id, reason: 'Court order' });

    expect(held).toMatchObject({
      status: 'ended',
      deletionHeldAt: NOW,
      deletionHoldReason: 'Court order',
    });
    expect(await accounts.findById(account.id)).toEqual(held);
  });

  it('keeps the moment of the first hold when the reason is written again', async () => {
    const { hold, clock, account } = await setup();
    await hold.execute({ accountId: account.id, reason: 'Court order' });
    clock.advanceBy(LATER.getTime() - NOW.getTime());

    const again = await hold.execute({ accountId: account.id, reason: 'Court order, extended' });

    expect(again).toMatchObject({
      deletionHeldAt: NOW,
      deletionHoldReason: 'Court order, extended',
    });
  });

  it('answers not found for an account that does not exist, or vanished in between', async () => {
    const { hold, accounts, clock, account } = await setup();
    const vanishing = new HoldAccountDeletionUseCase(
      accounts,
      { hold: () => Promise.resolve(null), release: () => Promise.resolve(null) },
      clock,
    );

    await expect(hold.execute({ accountId: MISSING_ID, reason: 'x' })).rejects.toBeInstanceOf(
      AccountNotFoundError,
    );
    await expect(vanishing.execute({ accountId: account.id, reason: 'x' })).rejects.toBeInstanceOf(
      AccountNotFoundError,
    );
  });
});

describe('ReleaseAccountDeletionUseCase', () => {
  it('lets the deletion go ahead again', async () => {
    const { hold, release, account } = await setup();
    await hold.execute({ accountId: account.id, reason: 'Court order' });

    await expect(release.execute({ accountId: account.id })).resolves.toMatchObject({
      deletionHeldAt: null,
      deletionHoldReason: null,
    });
  });

  it('answers not found for an account that does not exist', async () => {
    const { release } = await setup();

    await expect(release.execute({ accountId: MISSING_ID })).rejects.toBeInstanceOf(
      AccountNotFoundError,
    );
  });
});

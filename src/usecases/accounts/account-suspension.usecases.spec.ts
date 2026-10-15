import { AccountNotFoundError } from '../../domain/errors/account.errors';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAccountRepository } from '../../test-utils/in-memory-account.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { ResumeAccountUseCase } from './resume-account.usecase';
import { SuspendAccountUseCase } from './suspend-account.usecase';

const NOW = new Date('2026-11-03T12:00:00.000Z');
const LATER = new Date('2026-11-04T09:00:00.000Z');
const OWNER_ID = 'ad000000-0000-4000-a000-000000000001';
const MISSING_ID = 'ffffffff-ffff-4fff-bfff-ffffffffffff';

async function setup() {
  const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
  const clock = new FixedClock(NOW);
  const account = await accounts.create({ ownerAdminId: OWNER_ID, status: 'active' });
  return {
    accounts,
    clock,
    account,
    suspend: new SuspendAccountUseCase(accounts, accounts, clock),
    resume: new ResumeAccountUseCase(accounts),
  };
}

describe('SuspendAccountUseCase', () => {
  it('marks the account suspended now, with the reason, and leaves its status alone', async () => {
    const { suspend, accounts, account } = await setup();

    const suspended = await suspend.execute({ accountId: account.id, reason: 'Forged traffic' });

    expect(suspended).toMatchObject({
      status: 'active',
      suspendedAt: NOW,
      suspensionReason: 'Forged traffic',
    });
    expect(await accounts.findById(account.id)).toEqual(suspended);
  });

  it('keeps the moment of the first suspension when the reason is written again', async () => {
    const { suspend, clock, account } = await setup();
    await suspend.execute({ accountId: account.id, reason: 'Forged traffic' });
    clock.advanceBy(LATER.getTime() - NOW.getTime());

    const again = await suspend.execute({ accountId: account.id, reason: 'Forged traffic, again' });

    expect(again).toMatchObject({ suspendedAt: NOW, suspensionReason: 'Forged traffic, again' });
  });

  it('answers not found for an account that does not exist', async () => {
    const { suspend } = await setup();

    await expect(
      suspend.execute({ accountId: MISSING_ID, reason: 'Forged traffic' }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
  });

  it('answers not found when the account is deleted between reading and writing', async () => {
    const { accounts, clock, account } = await setup();
    const vanishing = new SuspendAccountUseCase(
      accounts,
      { suspend: () => Promise.resolve(null), resume: () => Promise.resolve(null) },
      clock,
    );

    await expect(
      vanishing.execute({ accountId: account.id, reason: 'Forged traffic' }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
  });
});

describe('ResumeAccountUseCase', () => {
  it('takes the suspension and its reason away', async () => {
    const { suspend, resume, account } = await setup();
    await suspend.execute({ accountId: account.id, reason: 'Forged traffic' });

    await expect(resume.execute({ accountId: account.id })).resolves.toMatchObject({
      status: 'active',
      suspendedAt: null,
      suspensionReason: null,
    });
  });

  it('answers not found for an account that does not exist', async () => {
    const { resume } = await setup();

    await expect(resume.execute({ accountId: MISSING_ID })).rejects.toBeInstanceOf(
      AccountNotFoundError,
    );
  });
});

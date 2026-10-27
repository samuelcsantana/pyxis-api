import type { SignUpSettings } from '../../domain/accounts/sign-up-settings';
import { InMemoryAccountRepository } from '../../test-utils/in-memory-account.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { FixedClock } from '../../test-utils/fixed-clock';
import { FREE_ACCOUNT_COUNT_TTL_MS, ReadSignUpStatusUseCase } from './read-sign-up-status.usecase';

const NOW = new Date('2026-11-20T12:00:00.000Z');

const OPEN: SignUpSettings = {
  open: true,
  termsVersion: '2026-11-01',
  termsUrl: 'https://example.com/terms',
  dashboardOrigin: 'https://app.example.com',
  freePlanOpen: true,
  freeAccountsMax: 2,
  trialOffered: true,
  freePlanTermsForEarlierAccountsFrom: null,
};

async function statusWith(settings: SignUpSettings, freeAccounts: number) {
  const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
  for (let index = 0; index < freeAccounts; index += 1) {
    await accounts.create({ ownerAdminId: `owner-${String(index)}`, status: 'free' });
  }
  await accounts.create({ ownerAdminId: 'paying', status: 'active' });
  return new ReadSignUpStatusUseCase(accounts, settings, new FixedClock(NOW)).execute();
}

describe('ReadSignUpStatusUseCase', () => {
  it('says the free plan takes new owners while it holds fewer accounts than its maximum', async () => {
    expect(await statusWith(OPEN, 1)).toEqual({
      open: true,
      termsVersion: '2026-11-01',
      termsUrl: 'https://example.com/terms',
      freePlan: 'open',
    });
  });

  it('says the free plan is full once it holds its maximum, whatever the paid accounts', async () => {
    expect((await statusWith(OPEN, 2)).freePlan).toBe('full');
  });

  it('says the free plan is closed while its switch is off', async () => {
    expect((await statusWith({ ...OPEN, freePlanOpen: false }, 0)).freePlan).toBe('closed');
  });

  it('counts the free accounts at most once a minute, since anyone can ask', async () => {
    const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
    const clock = new FixedClock(NOW);
    const status = new ReadSignUpStatusUseCase(accounts, OPEN, clock);
    const count = jest.spyOn(accounts, 'freeAccountCount');

    expect((await status.execute()).freePlan).toBe('open');
    await accounts.create({ ownerAdminId: 'first', status: 'free' });
    await accounts.create({ ownerAdminId: 'second', status: 'free' });
    clock.advanceBy(FREE_ACCOUNT_COUNT_TTL_MS - 1);
    expect((await status.execute()).freePlan).toBe('open');
    clock.advanceBy(1);
    expect((await status.execute()).freePlan).toBe('full');
    expect(count).toHaveBeenCalledTimes(2);
  });

  it('says sign-up and the free plan are closed while sign-up is closed', async () => {
    expect(await statusWith({ ...OPEN, open: false }, 0)).toEqual({
      open: false,
      termsVersion: null,
      termsUrl: null,
      freePlan: 'closed',
    });
  });
});

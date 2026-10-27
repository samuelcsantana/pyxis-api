import type { SignUpSettings } from '../../domain/accounts/sign-up-settings';
import { InMemoryAccountRepository } from '../../test-utils/in-memory-account.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { ReadSignUpStatusUseCase } from './read-sign-up-status.usecase';

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
  return new ReadSignUpStatusUseCase(accounts, settings).execute();
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

  it('says sign-up and the free plan are closed while sign-up is closed', async () => {
    expect(await statusWith({ ...OPEN, open: false }, 0)).toEqual({
      open: false,
      termsVersion: null,
      termsUrl: null,
      freePlan: 'closed',
    });
  });
});

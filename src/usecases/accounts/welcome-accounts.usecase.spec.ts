import { Logger } from '@nestjs/common';
import type { SignUpSettings } from '../../domain/accounts/sign-up-settings';
import type { WelcomeTarget } from '../../domain/repositories/account-welcome.repository';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAccountWelcomeRepository } from '../../test-utils/in-memory-account-welcome.repository';
import { RecordingMailSender } from '../../test-utils/recording-mail-sender';
import { WelcomeAccountsUseCase } from './welcome-accounts.usecase';

const NOW = new Date('2026-11-02T13:00:00.000Z');
const TRIAL_END = new Date('2026-11-16T13:00:00.000Z');
const SETTINGS: SignUpSettings = {
  open: true,
  termsVersion: '2026-11-01',
  termsUrl: 'https://example.com/termos',
  dashboardOrigin: 'https://app.example.com',
};
const TARGET: WelcomeTarget = {
  accountId: 'acc-1',
  ownerEmail: 'ana@example.com',
  ownerLanguage: 'pt-BR',
  status: 'trialing',
  trialEndsAt: TRIAL_END,
  termsVersion: '2026-11-01',
};

function setup(settings: SignUpSettings = SETTINGS) {
  const welcomes = new InMemoryAccountWelcomeRepository();
  const mail = new RecordingMailSender();
  const useCase = new WelcomeAccountsUseCase(welcomes, mail, new FixedClock(NOW), settings);
  return { welcomes, mail, useCase };
}

describe('WelcomeAccountsUseCase', () => {
  let error: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('welcomes the owner with the end of the trial and the terms they accepted, once', async () => {
    const { welcomes, mail, useCase } = setup();
    welcomes.add(TARGET);

    expect(await useCase.tryWelcome('acc-1')).toBe(true);
    expect(await useCase.tryWelcome('acc-1')).toBe(false);

    expect(mail.welcomes).toEqual([
      {
        email: 'ana@example.com',
        welcome: {
          trialEndsAt: TRIAL_END,
          terms: { version: '2026-11-01', url: 'https://example.com/termos' },
        },
        language: 'pt-BR',
      },
    ]);
    expect(welcomes.welcomedAt('acc-1')).toEqual(NOW);
  });

  it('mentions no trial once it is over, and no terms without both their version and address', async () => {
    const withoutAddress = setup({ ...SETTINGS, termsUrl: null });
    withoutAddress.welcomes.add({ ...TARGET, status: 'active' });
    const withoutVersion = setup();
    withoutVersion.welcomes.add({ ...TARGET, termsVersion: null });

    await withoutAddress.useCase.tryWelcome('acc-1');
    await withoutVersion.useCase.tryWelcome('acc-1');

    expect(withoutAddress.mail.welcomes[0]?.welcome).toEqual({ trialEndsAt: null, terms: null });
    expect(withoutVersion.mail.welcomes[0]?.welcome.terms).toBeNull();
  });

  it('welcomes nobody for an account it does not know or that has no access', async () => {
    const { welcomes, mail, useCase } = setup();
    welcomes.add({ ...TARGET, status: 'ended' });

    expect(await useCase.tryWelcome('missing')).toBe(false);
    expect(await useCase.tryWelcome('acc-1')).toBe(false);
    expect(mail.welcomes).toEqual([]);
  });

  it('keeps the account waiting when the e-mail fails, and says so in the log', async () => {
    const { welcomes, mail, useCase } = setup();
    welcomes.add(TARGET);
    mail.failFor('ana@example.com', new Error('provider down'));

    expect(await useCase.tryWelcome('acc-1')).toBe(false);
    expect(welcomes.welcomedAt('acc-1')).toBeNull();
    expect(error).toHaveBeenCalledWith({
      message: 'accounts.welcome_failed',
      accountId: 'acc-1',
      reason: 'Error: provider down',
    });
  });

  it('welcomes every signed-up account still waiting, and counts them', async () => {
    const { welcomes, mail, useCase } = setup();
    welcomes.add(TARGET);
    welcomes.add({ ...TARGET, accountId: 'acc-2', ownerEmail: 'bia@example.com' });
    welcomes.add({ ...TARGET, accountId: 'linked', ownerEmail: 'carla@example.com' }, false);
    mail.failFor('bia@example.com', new Error('provider down'));

    expect(await useCase.welcomePending()).toBe(1);
    expect(mail.welcomes.map(({ email }) => email)).toEqual(['ana@example.com']);
  });

  it('marks nothing for an account it does not know', async () => {
    const { welcomes } = setup();

    await welcomes.markWelcomed('missing', NOW);

    expect(welcomes.welcomedAt('missing')).toBeUndefined();
  });
});

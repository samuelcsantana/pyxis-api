import { Logger } from '@nestjs/common';
import type { SignUpSettings } from '../../domain/accounts/sign-up-settings';
import type { SubscriptionConfirmationTarget } from '../../domain/repositories/subscription-confirmation.repository';
import { InMemorySubscriptionConfirmationRepository } from '../../test-utils/in-memory-subscription-confirmation.repository';
import { RecordingMailSender } from '../../test-utils/recording-mail-sender';
import { ConfirmSubscriptionsUseCase } from './confirm-subscriptions.usecase';

const SETTINGS: SignUpSettings = {
  open: true,
  termsVersion: '1.3',
  termsUrl: 'https://example.com/termos',
  dashboardOrigin: 'https://app.example.com',
  freePlanOpen: true,
  freeAccountsMax: 200,
  trialOffered: false,
};
const TARGET: SubscriptionConfirmationTarget = {
  accountId: 'acc-1',
  ownerEmail: 'ana@example.com',
  ownerLanguage: 'pt-BR',
  billingInterval: 'month',
  termsVersion: '1.3',
};

function setup(settings: SignUpSettings = SETTINGS) {
  const confirmations = new InMemorySubscriptionConfirmationRepository();
  const mail = new RecordingMailSender();
  const useCase = new ConfirmSubscriptionsUseCase(confirmations, mail, settings);
  return { confirmations, mail, useCase };
}

describe('ConfirmSubscriptionsUseCase', () => {
  let error: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('confirms the subscription with its interval, the withdrawal days and the terms, once', async () => {
    const { confirmations, mail, useCase } = setup();
    confirmations.add(TARGET);

    expect(await useCase.tryConfirm('acc-1')).toBe(true);
    expect(await useCase.tryConfirm('acc-1')).toBe(false);

    expect(mail.subscriptionConfirmations).toEqual([
      {
        email: 'ana@example.com',
        confirmation: {
          interval: 'month',
          withdrawalDays: 7,
          terms: { version: '1.3', url: 'https://example.com/termos' },
        },
        language: 'pt-BR',
      },
    ]);
    expect(confirmations.isDue('acc-1')).toBe(false);
  });

  it('names no terms without both their version and their address', async () => {
    const withoutAddress = setup({ ...SETTINGS, termsUrl: null });
    withoutAddress.confirmations.add(TARGET);
    const withoutVersion = setup();
    withoutVersion.confirmations.add({ ...TARGET, termsVersion: null });

    await withoutAddress.useCase.tryConfirm('acc-1');
    await withoutVersion.useCase.tryConfirm('acc-1');

    expect(withoutAddress.mail.subscriptionConfirmations[0]?.confirmation.terms).toBeNull();
    expect(withoutVersion.mail.subscriptionConfirmations[0]?.confirmation.terms).toBeNull();
  });

  it('keeps the confirmation due when the e-mail fails, and says so in the log', async () => {
    const { confirmations, mail, useCase } = setup();
    confirmations.add(TARGET);
    mail.failFor('ana@example.com', new Error('provider down'));

    expect(await useCase.tryConfirm('acc-1')).toBe(false);

    expect(confirmations.isDue('acc-1')).toBe(true);
    expect(error).toHaveBeenCalledWith({
      message: 'billing.subscription_confirmation_failed',
      accountId: 'acc-1',
      reason: 'Error: provider down',
    });
  });

  it('confirms every subscription still due, counting those sent', async () => {
    const { confirmations, mail, useCase } = setup();
    confirmations.add(TARGET);
    confirmations.add({ ...TARGET, accountId: 'acc-2', ownerEmail: 'bia@example.com' });
    mail.failFor('bia@example.com', new Error('provider down'));

    expect(await useCase.confirmPending()).toBe(1);
    expect(confirmations.isDue('acc-2')).toBe(true);
  });
});

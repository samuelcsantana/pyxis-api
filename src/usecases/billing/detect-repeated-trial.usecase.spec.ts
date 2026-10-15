import { Logger } from '@nestjs/common';
import type { BillingSubscription } from '../../domain/billing/billing-gateway';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryTrialCardRepository } from '../../test-utils/in-memory-trial-card.repository';
import { DetectRepeatedTrialUseCase } from './detect-repeated-trial.usecase';

const NOW = new Date('2026-10-20T12:00:00.000Z');
const EARLIER = new Date('2026-08-01T12:00:00.000Z');
const ACCOUNT_ID = 'acc00000-0000-4000-a000-000000000001';
const FIRST_ACCOUNT = 'acc00000-0000-4000-a000-000000000002';
const SECOND_ACCOUNT = 'acc00000-0000-4000-a000-000000000003';

const TRIALING: BillingSubscription = {
  subscriptionId: 'sub_1',
  customerId: 'cus_1',
  accountId: ACCOUNT_ID,
  status: 'trialing',
  interval: 'month',
  trialEndsAt: new Date('2026-11-03T12:00:00.000Z'),
  currentPeriodEndsAt: new Date('2026-11-03T12:00:00.000Z'),
  cancelAtPeriodEnd: false,
  cardFingerprint: 'fp_card_1',
};

function setup() {
  const trialCards = new InMemoryTrialCardRepository();
  const useCase = new DetectRepeatedTrialUseCase(trialCards, new FixedClock(NOW));
  const logs: { level: string; message: unknown }[] = [];
  jest.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => {
    logs.push({ level: 'warn', message });
  });
  jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
    logs.push({ level: 'error', message });
  });
  return { trialCards, useCase, logs };
}

describe('DetectRepeatedTrialUseCase', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records the card of a first trial and stays quiet', async () => {
    const { trialCards, useCase, logs } = setup();

    await useCase.tryDetect(ACCOUNT_ID, TRIALING);

    expect(trialCards.cards).toEqual([
      { fingerprint: 'fp_card_1', accountId: ACCOUNT_ID, trialStartedAt: NOW },
    ]);
    expect(logs).toEqual([]);
  });

  it('records nothing for a subscription without a trial or without a known card', async () => {
    const { trialCards, useCase } = setup();

    await useCase.tryDetect(ACCOUNT_ID, { ...TRIALING, trialEndsAt: null });
    await useCase.tryDetect(ACCOUNT_ID, { ...TRIALING, cardFingerprint: null });

    expect(trialCards.cards).toEqual([]);
  });

  it('warns once, with the earlier accounts, when a card starts a trial in another account', async () => {
    const { trialCards, useCase, logs } = setup();
    await trialCards.record({
      fingerprint: 'fp_card_1',
      accountId: SECOND_ACCOUNT,
      trialStartedAt: NOW,
    });
    await trialCards.record({
      fingerprint: 'fp_card_1',
      accountId: FIRST_ACCOUNT,
      trialStartedAt: EARLIER,
    });

    await useCase.tryDetect(ACCOUNT_ID, TRIALING);
    await useCase.tryDetect(ACCOUNT_ID, { ...TRIALING, status: 'active' });

    expect(logs).toEqual([
      {
        level: 'warn',
        message: {
          message: 'billing.repeated_trial',
          accountId: ACCOUNT_ID,
          earlierAccountIds: [FIRST_ACCOUNT, SECOND_ACCOUNT],
        },
      },
    ]);
  });

  it('logs and swallows a failure, so the billing event is still applied', async () => {
    const { trialCards, useCase, logs } = setup();
    jest.spyOn(trialCards, 'record').mockRejectedValue(new Error('connection reset'));

    await expect(useCase.tryDetect(ACCOUNT_ID, TRIALING)).resolves.toBeUndefined();

    expect(logs).toEqual([
      {
        level: 'error',
        message: {
          message: 'billing.repeated_trial_check_failed',
          accountId: ACCOUNT_ID,
          reason: 'Error: connection reset',
        },
      },
    ]);
  });
});

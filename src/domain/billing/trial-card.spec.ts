import type { BillingSubscription } from './billing-gateway';
import { trialCardOf } from './trial-card';

const ACCOUNT_ID = 'acc00000-0000-4000-a000-000000000001';
const NOW = new Date('2026-10-20T12:00:00.000Z');

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

describe('trialCardOf', () => {
  it('records the card of a subscription that has a free trial', () => {
    expect(trialCardOf(ACCOUNT_ID, TRIALING, NOW)).toEqual({
      fingerprint: 'fp_card_1',
      accountId: ACCOUNT_ID,
      trialStartedAt: NOW,
    });
  });

  it('records nothing for a subscription without a trial or without a known card', () => {
    expect(trialCardOf(ACCOUNT_ID, { ...TRIALING, trialEndsAt: null }, NOW)).toBeNull();
    expect(trialCardOf(ACCOUNT_ID, { ...TRIALING, cardFingerprint: null }, NOW)).toBeNull();
  });
});

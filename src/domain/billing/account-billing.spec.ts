import { type AccountBillingState, billingUpdateFor } from './account-billing';
import type { BillingSubscription } from './billing-gateway';

const NOW = new Date('2026-10-20T12:00:00.000Z');
const TRIAL_END = new Date('2026-10-28T12:00:00.000Z');
const PERIOD_END = new Date('2026-11-28T12:00:00.000Z');
const CURRENT: AccountBillingState = {
  accountId: 'acc00000-0000-4000-a000-000000000001',
  status: 'incomplete',
  accessEndsAt: null,
};

function subscription(overrides: Partial<BillingSubscription> = {}): BillingSubscription {
  return {
    subscriptionId: 'sub_1',
    customerId: 'cus_1',
    accountId: CURRENT.accountId,
    status: 'trialing',
    interval: 'month',
    trialEndsAt: TRIAL_END,
    currentPeriodEndsAt: TRIAL_END,
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

describe('billingUpdateFor', () => {
  it('copies the subscription ids, period and dates onto the account', () => {
    expect(billingUpdateFor(subscription(), CURRENT, NOW)).toEqual({
      status: 'trialing',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      billingInterval: 'month',
      trialEndsAt: TRIAL_END,
      currentPeriodEndsAt: TRIAL_END,
      accessEndsAt: null,
      restoresAccess: true,
    });
  });

  it('restores access while the subscription runs, and not once it has ended', () => {
    expect(
      billingUpdateFor(subscription({ status: 'past_due' }), CURRENT, NOW).restoresAccess,
    ).toBe(true);
    expect(
      billingUpdateFor(subscription({ status: 'canceled' }), CURRENT, NOW).restoresAccess,
    ).toBe(false);
    expect(
      billingUpdateFor(subscription({ status: 'incomplete' }), CURRENT, NOW).restoresAccess,
    ).toBe(false);
  });

  it.each([
    ['active', 'active'],
    ['past_due', 'past_due'],
    ['incomplete', 'incomplete'],
    ['canceled', 'ended'],
    ['unpaid', 'ended'],
    ['incomplete_expired', 'ended'],
    ['paused', 'ended'],
  ])('reads a %s subscription as %s', (stripeStatus, status) => {
    expect(billingUpdateFor(subscription({ status: stripeStatus }), CURRENT, NOW).status).toBe(
      status,
    );
  });

  it('keeps access until the trial ends when a trial will not turn into a payment', () => {
    const update = billingUpdateFor(subscription({ cancelAtPeriodEnd: true }), CURRENT, NOW);

    expect(update).toMatchObject({ status: 'ending', accessEndsAt: TRIAL_END });
  });

  it('keeps access until the paid period ends when a paying account will not renew', () => {
    const update = billingUpdateFor(
      subscription({ status: 'active', currentPeriodEndsAt: PERIOD_END, cancelAtPeriodEnd: true }),
      CURRENT,
      NOW,
    );

    expect(update).toMatchObject({ status: 'ending', accessEndsAt: PERIOD_END });
  });

  it('ends access now when the subscription ends, and keeps the first end it recorded', () => {
    const ended = billingUpdateFor(subscription({ status: 'canceled' }), CURRENT, NOW);
    const later = billingUpdateFor(
      subscription({ status: 'canceled' }),
      { ...CURRENT, status: 'ended', accessEndsAt: NOW },
      new Date('2026-10-21T12:00:00.000Z'),
    );

    expect(ended.accessEndsAt).toEqual(NOW);
    expect(later.accessEndsAt).toEqual(NOW);
  });
});

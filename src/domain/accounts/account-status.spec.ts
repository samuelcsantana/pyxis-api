import {
  ACCOUNT_STATUSES,
  hasAccess,
  hasRunningSubscription,
  isOnFreePlan,
  isOnProPlan,
} from './account-status';

describe('hasAccess', () => {
  it.each(['trialing', 'active', 'past_due', 'ending', 'comped', 'free'] as const)(
    'gives a %s account the use of its projects',
    (status) => {
      expect(hasAccess(status)).toBe(true);
    },
  );

  it.each(['incomplete', 'ended'] as const)(
    'keeps a %s account from changing its projects until it subscribes',
    (status) => {
      expect(hasAccess(status)).toBe(false);
    },
  );

  it('decides for every status', () => {
    expect(ACCOUNT_STATUSES.filter(hasAccess)).toHaveLength(6);
  });
});

describe('hasRunningSubscription', () => {
  it.each(['trialing', 'active', 'past_due', 'ending'] as const)(
    'knows a %s account has a subscription to cancel',
    (status) => {
      expect(hasRunningSubscription(status)).toBe(true);
    },
  );

  it.each(['incomplete', 'ended', 'comped', 'free'] as const)(
    'knows a %s account has none',
    (status) => {
      expect(hasRunningSubscription(status)).toBe(false);
    },
  );
});

describe('isOnFreePlan', () => {
  it('puts only a free account on the free plan', () => {
    expect(ACCOUNT_STATUSES.filter(isOnFreePlan)).toEqual(['free']);
  });
});

describe('isOnProPlan', () => {
  it.each(['trialing', 'active', 'past_due', 'ending', 'comped'] as const)(
    'puts a %s account on the Pro plan',
    (status) => {
      expect(isOnProPlan(status)).toBe(true);
    },
  );

  it.each(['free', 'incomplete', 'ended'] as const)(
    'keeps a %s account off the Pro plan',
    (status) => {
      expect(isOnProPlan(status)).toBe(false);
    },
  );
});

import { ACCOUNT_STATUSES, hasAccess, hasRunningSubscription } from './account-status';

describe('hasAccess', () => {
  it.each(['trialing', 'active', 'past_due', 'ending', 'comped'] as const)(
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
    expect(ACCOUNT_STATUSES.filter(hasAccess)).toHaveLength(5);
  });
});

describe('hasRunningSubscription', () => {
  it.each(['trialing', 'active', 'past_due', 'ending'] as const)(
    'knows a %s account has a subscription to cancel',
    (status) => {
      expect(hasRunningSubscription(status)).toBe(true);
    },
  );

  it.each(['incomplete', 'ended', 'comped'] as const)('knows a %s account has none', (status) => {
    expect(hasRunningSubscription(status)).toBe(false);
  });
});

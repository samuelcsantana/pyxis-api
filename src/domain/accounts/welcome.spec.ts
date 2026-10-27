import { welcomePlanOf } from './welcome';

const NO_OVERRIDES = { eventsPerMonthLimit: null, projectsLimit: null, peopleLimit: null };
const TRIAL_END = new Date('2026-11-16T13:00:00.000Z');

describe('welcomePlanOf', () => {
  it('welcomes a free account with its limits and its pause point', () => {
    expect(welcomePlanOf({ ...NO_OVERRIDES, status: 'free', trialEndsAt: null })).toEqual({
      kind: 'free',
      limits: { eventsPerMonth: 10_000, projects: 1, people: 1 },
      pauseAtEvents: 10_000,
    });
  });

  it('follows the limits Pyxis set for a free account', () => {
    expect(
      welcomePlanOf({
        ...NO_OVERRIDES,
        status: 'free',
        eventsPerMonthLimit: 20_000,
        trialEndsAt: null,
      }),
    ).toEqual({
      kind: 'free',
      limits: { eventsPerMonth: 20_000, projects: 1, people: 1 },
      pauseAtEvents: 20_000,
    });
  });

  it('welcomes a trial with its end, and a trial without an end as a subscription', () => {
    expect(welcomePlanOf({ ...NO_OVERRIDES, status: 'trialing', trialEndsAt: TRIAL_END })).toEqual({
      kind: 'trial',
      trialEndsAt: TRIAL_END,
    });
    expect(welcomePlanOf({ ...NO_OVERRIDES, status: 'trialing', trialEndsAt: null })).toEqual({
      kind: 'subscription',
    });
  });

  it('welcomes any other account as a subscription, even with a past trial end', () => {
    expect(welcomePlanOf({ ...NO_OVERRIDES, status: 'active', trialEndsAt: TRIAL_END })).toEqual({
      kind: 'subscription',
    });
  });
});

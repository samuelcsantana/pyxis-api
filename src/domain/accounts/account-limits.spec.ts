import {
  eventsPerMonthOf,
  ingestionPauseThresholdOf,
  NO_LIMIT_OVERRIDES,
  type PlanAccount,
  planLimitsOf,
} from './account-limits';
import type { AccountStatus } from './account-status';

function account(status: AccountStatus, overrides: Partial<PlanAccount> = {}): PlanAccount {
  return { ...NO_LIMIT_OVERRIDES, status, ...overrides };
}

describe('planLimitsOf', () => {
  it('gives a free account 10,000 events a month, 1 project and 1 person', () => {
    expect(planLimitsOf(account('free'))).toEqual({
      eventsPerMonth: 10_000,
      projects: 1,
      people: 1,
    });
  });

  it.each(['incomplete', 'trialing', 'active', 'past_due', 'ending', 'ended', 'comped'] as const)(
    'gives a %s account the paid plan: 100,000 events, 3 projects and 3 people',
    (status) => {
      expect(planLimitsOf(account(status))).toEqual({
        eventsPerMonth: 100_000,
        projects: 3,
        people: 3,
      });
    },
  );

  it('lets each limit set on a free account win over the free plan', () => {
    expect(planLimitsOf(account('free', { eventsPerMonthLimit: 25_000 }))).toEqual({
      eventsPerMonth: 25_000,
      projects: 1,
      people: 1,
    });
    expect(planLimitsOf(account('free', { projectsLimit: 2, peopleLimit: 4 }))).toEqual({
      eventsPerMonth: 10_000,
      projects: 2,
      people: 4,
    });
  });

  it('lets each limit set on a paid account win over the paid plan', () => {
    expect(
      planLimitsOf(
        account('active', { eventsPerMonthLimit: 1_000_000, projectsLimit: 10, peopleLimit: 8 }),
      ),
    ).toEqual({ eventsPerMonth: 1_000_000, projects: 10, people: 8 });
  });
});

describe('eventsPerMonthOf', () => {
  it('reads the plan of the status unless the account has its own monthly limit', () => {
    expect(eventsPerMonthOf(account('free'))).toBe(10_000);
    expect(eventsPerMonthOf(account('active'))).toBe(100_000);
    expect(eventsPerMonthOf(account('free', { eventsPerMonthLimit: 50_000 }))).toBe(50_000);
  });
});

describe('ingestionPauseThresholdOf', () => {
  it('pauses the free plan at 100% of its monthly events', () => {
    expect(ingestionPauseThresholdOf(account('free'))).toBe(10_000);
    expect(ingestionPauseThresholdOf(account('free', { eventsPerMonthLimit: 20_000 }))).toBe(
      20_000,
    );
  });

  it('pauses the paid plan at 150% of its monthly events', () => {
    expect(ingestionPauseThresholdOf(account('active'))).toBe(150_000);
    expect(ingestionPauseThresholdOf(account('comped'))).toBe(150_000);
    expect(ingestionPauseThresholdOf(account('active', { eventsPerMonthLimit: 1_000_000 }))).toBe(
      1_500_000,
    );
  });

  it('rounds a fractional threshold up to the first whole event that reaches it', () => {
    expect(ingestionPauseThresholdOf(account('active', { eventsPerMonthLimit: 33_333 }))).toBe(
      50_000,
    );
  });
});

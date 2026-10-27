export const HOSTED_PLAN_LIMITS = {
  eventsPerMonth: 100_000,
  projects: 3,
  people: 3,
} as const;

export const HOSTED_PLAN_PAUSE_RATIO = 1.5;

export const FREE_PLAN_LIMITS = {
  eventsPerMonth: 10_000,
  projects: 1,
  people: 1,
} as const;

export const FREE_PLAN_PAUSE_RATIO = 1;

export const TRIAL_DAYS = 14;

export const PRICE_LOOKUP_KEYS = {
  month: 'pyxis_monthly_brl',
  year: 'pyxis_yearly_brl',
} as const;

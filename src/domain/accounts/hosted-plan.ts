export const HOSTED_PLAN_LIMITS = {
  eventsPerMonth: 100_000,
  projects: 3,
  people: 3,
} as const;

export const INGESTION_PAUSE_RATIO = 1.5;

export const TRIAL_DAYS = 14;

export const PRICE_LOOKUP_KEYS = {
  month: 'pyxis_monthly_brl',
  year: 'pyxis_yearly_brl',
} as const;

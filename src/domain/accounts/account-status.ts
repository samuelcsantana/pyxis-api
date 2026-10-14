export const ACCOUNT_STATUSES = [
  'incomplete',
  'trialing',
  'active',
  'past_due',
  'ending',
  'ended',
  'comped',
] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

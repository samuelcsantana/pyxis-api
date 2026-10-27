export const ACCOUNT_STATUSES = [
  'incomplete',
  'trialing',
  'active',
  'past_due',
  'ending',
  'ended',
  'comped',
  'free',
] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

const STATUSES_WITH_ACCESS: ReadonlySet<AccountStatus> = new Set([
  'trialing',
  'active',
  'past_due',
  'ending',
  'comped',
  'free',
]);

export function hasAccess(status: AccountStatus): boolean {
  return STATUSES_WITH_ACCESS.has(status);
}

const STATUSES_WITH_A_SUBSCRIPTION: ReadonlySet<AccountStatus> = new Set([
  'trialing',
  'active',
  'past_due',
  'ending',
]);

export function hasRunningSubscription(status: AccountStatus): boolean {
  return STATUSES_WITH_A_SUBSCRIPTION.has(status);
}

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

const STATUSES_WITH_ACCESS: ReadonlySet<AccountStatus> = new Set([
  'trialing',
  'active',
  'past_due',
  'ending',
  'comped',
]);

export function hasAccess(status: AccountStatus): boolean {
  return STATUSES_WITH_ACCESS.has(status);
}

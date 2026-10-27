import type { Account } from '../entities/account.entity';
import type { SignUpSettings } from './sign-up-settings';

export const FREE_PLAN_STATES = ['open', 'full', 'closed'] as const;

export type FreePlanState = (typeof FREE_PLAN_STATES)[number];

export function canTakeAFreePlace(account: Account): boolean {
  return account.status === 'incomplete';
}

export function freePlanStateOf(
  settings: Pick<SignUpSettings, 'open' | 'freePlanOpen' | 'freeAccountsMax'>,
  freeAccounts: number,
): FreePlanState {
  if (!settings.open || !settings.freePlanOpen) {
    return 'closed';
  }
  return freeAccounts < settings.freeAccountsMax ? 'open' : 'full';
}

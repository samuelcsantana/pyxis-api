import type { Account } from '../entities/account.entity';
import type { SignUpSettings } from './sign-up-settings';

export const FREE_PLAN_STATES = ['open', 'full', 'closed'] as const;

export type FreePlanState = (typeof FREE_PLAN_STATES)[number];

export const FREE_PLACES = [
  'placed',
  'waitlisted',
  'taken_by_same_mailbox',
  'not_offered',
] as const;

export type FreePlace = (typeof FREE_PLACES)[number];

export type FreePlacement = 'place' | 'waitlist' | 'refuse';

export interface FreePlaceSeat {
  readonly freeAccounts: number;
  readonly freeAccountsMax: number;
  readonly mailboxHoldsAFreePlace: boolean;
}

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

export function freePlacementOf(seat: FreePlaceSeat): FreePlacement {
  if (seat.mailboxHoldsAFreePlace) {
    return 'refuse';
  }
  return seat.freeAccounts < seat.freeAccountsMax ? 'place' : 'waitlist';
}

export function freePlaceOf(account: Account, placement: FreePlacement | null): FreePlace {
  if (account.status === 'free') {
    return 'placed';
  }
  if (!canTakeAFreePlace(account)) {
    return 'not_offered';
  }
  if (account.freeWaitlistedAt !== null) {
    return 'waitlisted';
  }
  return placement === 'refuse' ? 'taken_by_same_mailbox' : 'not_offered';
}

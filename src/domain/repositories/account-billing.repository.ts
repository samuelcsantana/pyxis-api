import type { AccountBillingState, AccountBillingUpdate } from '../billing/account-billing';

export interface BillingOwnerLookup {
  readonly accountId: string | null;
  readonly subscriptionId: string | null;
  readonly customerId: string | null;
}

export interface AccountBillingRepository {
  find(lookup: BillingOwnerLookup): Promise<AccountBillingState | null>;
  apply(accountId: string, update: AccountBillingUpdate): Promise<void>;
}

export const ACCOUNT_BILLING_REPOSITORY = Symbol('AccountBillingRepository');

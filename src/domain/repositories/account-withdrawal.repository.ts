export interface AccountWithdrawalRepository {
  subscriptionOf(accountId: string): Promise<string | null>;
  returnToFreePlan(accountId: string): Promise<void>;
}

export const ACCOUNT_WITHDRAWAL_REPOSITORY = Symbol('AccountWithdrawalRepository');

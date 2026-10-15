export interface AccountClosureRepository {
  subscriptionOf(accountId: string): Promise<string | null>;
  close(accountId: string, at: Date): Promise<void>;
  markEndedNotified(accountId: string, at: Date): Promise<void>;
}

export const ACCOUNT_CLOSURE_REPOSITORY = Symbol('AccountClosureRepository');

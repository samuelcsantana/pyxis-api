import type { Account } from '../entities/account.entity';

export interface AccountDeletionHoldRepository {
  hold(accountId: string, reason: string, at: Date): Promise<Account | null>;
  release(accountId: string): Promise<Account | null>;
}

export const ACCOUNT_DELETION_HOLD_REPOSITORY = Symbol('AccountDeletionHoldRepository');

import type { Account } from '../entities/account.entity';

export interface AccountSuspensionRepository {
  suspend(accountId: string, reason: string, at: Date): Promise<Account | null>;
  resume(accountId: string): Promise<Account | null>;
}

export const ACCOUNT_SUSPENSION_REPOSITORY = Symbol('AccountSuspensionRepository');

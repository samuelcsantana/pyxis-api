import type { Account } from '../entities/account.entity';

export interface AccountQuotaExemptionRepository {
  exemptFromPause(accountId: string, until: Date): Promise<Account | null>;
  endPauseExemption(accountId: string): Promise<Account | null>;
}

export const ACCOUNT_QUOTA_EXEMPTION_REPOSITORY = Symbol('AccountQuotaExemptionRepository');

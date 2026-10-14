import type { AccountMonthUsage } from '../accounts/account-quota';

export interface AccountUsageEntry {
  readonly accountId: string;
  readonly events: number;
  readonly ingestionPausedUntil: Date | null;
}

export interface RecordedUsage {
  readonly month: string;
  readonly events: number;
  readonly updatedAt: Date;
}

export interface AccountUsageRepository {
  measure(month: string, from: Date, to: Date): Promise<readonly AccountMonthUsage[]>;
  record(month: string, entries: readonly AccountUsageEntry[], at: Date): Promise<void>;
  markNotified(accountId: string, month: string, level: number): Promise<void>;
  recordedFor(accountId: string, month: string): Promise<RecordedUsage | null>;
}

export const ACCOUNT_USAGE_REPOSITORY = Symbol('AccountUsageRepository');

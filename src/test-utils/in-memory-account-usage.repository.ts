import type { AccountMonthUsage } from '../domain/accounts/account-quota';
import type {
  AccountUsageEntry,
  AccountUsageRepository,
  RecordedUsage,
} from '../domain/repositories/account-usage.repository';
import type { IngestionPauseRepository } from '../domain/repositories/ingestion-pause.repository';

export interface MeasuredWindow {
  readonly from: Date;
  readonly to: Date;
}

export class InMemoryAccountUsageRepository
  implements AccountUsageRepository, IngestionPauseRepository
{
  measured: readonly AccountMonthUsage[] = [];
  readonly windows: MeasuredWindow[] = [];
  private readonly recorded = new Map<string, RecordedUsage>();
  private readonly pauses = new Map<string, Date | null>();
  private readonly projectAccounts = new Map<string, string>();

  placeProject(projectId: string, accountId: string): void {
    this.projectAccounts.set(projectId, accountId);
  }

  pauseOf(accountId: string): Date | null {
    return this.pauses.get(accountId) ?? null;
  }

  measure(from: Date, to: Date): Promise<readonly AccountMonthUsage[]> {
    this.windows.push({ from, to });
    return Promise.resolve(this.measured);
  }

  record(month: string, entries: readonly AccountUsageEntry[], at: Date): Promise<void> {
    for (const entry of entries) {
      this.recorded.set(`${entry.accountId}/${month}`, {
        month,
        events: entry.events,
        updatedAt: at,
      });
      this.pauses.set(entry.accountId, entry.ingestionPausedUntil);
    }
    return Promise.resolve();
  }

  recordedFor(accountId: string, month: string): Promise<RecordedUsage | null> {
    return Promise.resolve(this.recorded.get(`${accountId}/${month}`) ?? null);
  }

  pausedUntil(projectId: string): Promise<Date | null> {
    const accountId = this.projectAccounts.get(projectId);
    return Promise.resolve(accountId === undefined ? null : this.pauseOf(accountId));
  }
}

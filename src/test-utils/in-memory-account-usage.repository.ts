import type { AccountMonthUsage } from '../domain/accounts/account-quota';
import type {
  AccountUsageEntry,
  AccountUsageRepository,
  RecordedUsage,
} from '../domain/repositories/account-usage.repository';
import type {
  ProjectAccountState,
  ProjectAccountStateRepository,
} from '../domain/repositories/project-account-state.repository';

export interface MeasuredWindow {
  readonly month: string;
  readonly from: Date;
  readonly to: Date;
}

export class InMemoryAccountUsageRepository
  implements AccountUsageRepository, ProjectAccountStateRepository
{
  measured: readonly AccountMonthUsage[] = [];
  readonly windows: MeasuredWindow[] = [];
  readonly notified = new Map<string, number>();
  private readonly recorded = new Map<string, RecordedUsage>();
  private readonly pauses = new Map<string, Date | null>();
  private readonly projectAccounts = new Map<string, string>();
  private readonly suspendedAccounts = new Set<string>();

  placeProject(projectId: string, accountId: string): void {
    this.projectAccounts.set(projectId, accountId);
  }

  markSuspended(accountId: string): void {
    this.suspendedAccounts.add(accountId);
  }

  pauseOf(accountId: string): Date | null {
    return this.pauses.get(accountId) ?? null;
  }

  measure(month: string, from: Date, to: Date): Promise<readonly AccountMonthUsage[]> {
    this.windows.push({ month, from, to });
    return Promise.resolve(
      this.measured.map((usage) => ({
        ...usage,
        notifiedLevel: this.notified.get(`${usage.accountId}/${month}`) ?? usage.notifiedLevel,
      })),
    );
  }

  markNotified(accountId: string, month: string, level: number): Promise<void> {
    this.notified.set(`${accountId}/${month}`, level);
    return Promise.resolve();
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

  stateOf(projectId: string): Promise<ProjectAccountState> {
    const accountId = this.projectAccounts.get(projectId);
    return Promise.resolve({
      ingestionPausedUntil: accountId === undefined ? null : this.pauseOf(accountId),
      suspended: accountId !== undefined && this.suspendedAccounts.has(accountId),
    });
  }
}

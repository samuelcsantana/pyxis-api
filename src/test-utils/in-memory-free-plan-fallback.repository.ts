import { hasRunningSubscription, type AccountStatus } from '../domain/accounts/account-status';
import type { FreePlanFit } from '../domain/accounts/free-plan-fallback';
import type {
  BackToFreeTarget,
  FreePlanFallbackRepository,
} from '../domain/repositories/free-plan-fallback.repository';

export interface FallbackAccount extends BackToFreeTarget {
  readonly status: AccountStatus;
  readonly fit: FreePlanFit;
}

export class InMemoryFreePlanFallbackRepository implements FreePlanFallbackRepository {
  private readonly accounts = new Map<string, FallbackAccount>();
  private readonly due = new Set<string>();
  readonly fellBack: { readonly accountId: string; readonly at: Date }[] = [];

  add(account: FallbackAccount): void {
    this.accounts.set(account.accountId, account);
  }

  statusOf(accountId: string): AccountStatus | undefined {
    return this.accounts.get(accountId)?.status;
  }

  isNoticeDue(accountId: string): boolean {
    return this.due.has(accountId);
  }

  fitOf(accountId: string): Promise<FreePlanFit | null> {
    return Promise.resolve(this.accounts.get(accountId)?.fit ?? null);
  }

  fallBack(accountId: string, at: Date): Promise<boolean> {
    const account = this.accounts.get(accountId);
    if (account === undefined || !hasRunningSubscription(account.status)) {
      return Promise.resolve(false);
    }
    this.accounts.set(accountId, { ...account, status: 'free' });
    this.due.add(accountId);
    this.fellBack.push({ accountId, at });
    return Promise.resolve(true);
  }

  toNotify(accountId: string): Promise<BackToFreeTarget | null> {
    const account = this.accounts.get(accountId);
    return Promise.resolve(
      account?.status === 'free' && this.due.has(accountId) ? targetOf(account) : null,
    );
  }

  pendingNotices(): Promise<readonly BackToFreeTarget[]> {
    return Promise.resolve(
      [...this.accounts.values()]
        .filter((account) => account.status === 'free' && this.due.has(account.accountId))
        .map(targetOf),
    );
  }

  markNotified(accountId: string): Promise<void> {
    this.due.delete(accountId);
    return Promise.resolve();
  }
}

function targetOf(account: FallbackAccount): BackToFreeTarget {
  return {
    accountId: account.accountId,
    ownerEmail: account.ownerEmail,
    ownerLanguage: account.ownerLanguage,
    eventsPerMonthLimit: account.eventsPerMonthLimit,
  };
}

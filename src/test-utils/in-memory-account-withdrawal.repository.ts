import type { AccountWithdrawalRepository } from '../domain/repositories/account-withdrawal.repository';

export class InMemoryAccountWithdrawalRepository implements AccountWithdrawalRepository {
  private readonly subscriptions = new Map<string, string>();
  readonly returnedToFree: string[] = [];
  readonly fitDueAt = new Map<string, Date | null>();

  subscribe(accountId: string, subscriptionId: string): void {
    this.subscriptions.set(accountId, subscriptionId);
  }

  subscriptionOf(accountId: string): Promise<string | null> {
    return Promise.resolve(this.subscriptions.get(accountId) ?? null);
  }

  returnToFreePlan(accountId: string, fitDueAt: Date | null): Promise<void> {
    this.subscriptions.delete(accountId);
    this.returnedToFree.push(accountId);
    this.fitDueAt.set(accountId, fitDueAt);
    return Promise.resolve();
  }
}

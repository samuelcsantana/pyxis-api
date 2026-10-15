import type { AccountClosureRepository } from '../domain/repositories/account-closure.repository';

export class InMemoryAccountClosureRepository implements AccountClosureRepository {
  private readonly subscriptions = new Map<string, string>();
  readonly closed = new Map<string, Date>();
  readonly notified = new Map<string, Date>();

  subscribe(accountId: string, subscriptionId: string): void {
    this.subscriptions.set(accountId, subscriptionId);
  }

  subscriptionOf(accountId: string): Promise<string | null> {
    return Promise.resolve(this.subscriptions.get(accountId) ?? null);
  }

  close(accountId: string, at: Date): Promise<void> {
    this.closed.set(accountId, at);
    return Promise.resolve();
  }

  markEndedNotified(accountId: string, at: Date): Promise<void> {
    this.notified.set(accountId, at);
    return Promise.resolve();
  }
}

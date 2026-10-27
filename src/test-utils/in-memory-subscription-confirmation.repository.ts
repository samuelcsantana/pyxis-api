import type {
  SubscriptionConfirmationRepository,
  SubscriptionConfirmationTarget,
} from '../domain/repositories/subscription-confirmation.repository';

export class InMemorySubscriptionConfirmationRepository implements SubscriptionConfirmationRepository {
  private readonly due = new Map<string, SubscriptionConfirmationTarget>();

  add(target: SubscriptionConfirmationTarget): void {
    this.due.set(target.accountId, target);
  }

  isDue(accountId: string): boolean {
    return this.due.has(accountId);
  }

  toConfirm(accountId: string): Promise<SubscriptionConfirmationTarget | null> {
    return Promise.resolve(this.due.get(accountId) ?? null);
  }

  pendingConfirmations(): Promise<readonly SubscriptionConfirmationTarget[]> {
    return Promise.resolve([...this.due.values()]);
  }

  markConfirmed(accountId: string): Promise<void> {
    this.due.delete(accountId);
    return Promise.resolve();
  }
}

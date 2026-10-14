import type { AccountBillingState, AccountBillingUpdate } from '../domain/billing/account-billing';
import type {
  AccountBillingRepository,
  BillingOwnerLookup,
} from '../domain/repositories/account-billing.repository';
import type {
  BillingEventRepository,
  ReceivedBillingEvent,
} from '../domain/repositories/billing-event.repository';

export interface BilledAccount extends AccountBillingState {
  readonly stripeCustomerId: string | null;
  readonly stripeSubscriptionId: string | null;
}

export class InMemoryAccountBillingRepository implements AccountBillingRepository {
  private readonly accounts = new Map<string, BilledAccount>();
  readonly updates: { readonly accountId: string; readonly update: AccountBillingUpdate }[] = [];

  add(account: BilledAccount): void {
    this.accounts.set(account.accountId, account);
  }

  stored(accountId: string): BilledAccount | undefined {
    return this.accounts.get(accountId);
  }

  find(lookup: BillingOwnerLookup): Promise<AccountBillingState | null> {
    const found = [...this.accounts.values()].find(
      (account) =>
        account.accountId === lookup.accountId ||
        (lookup.subscriptionId !== null &&
          account.stripeSubscriptionId === lookup.subscriptionId) ||
        (lookup.customerId !== null && account.stripeCustomerId === lookup.customerId),
    );
    return Promise.resolve(found ?? null);
  }

  apply(accountId: string, update: AccountBillingUpdate): Promise<void> {
    this.accounts.set(accountId, {
      accountId,
      status: update.status,
      accessEndsAt: update.accessEndsAt,
      stripeCustomerId: update.stripeCustomerId,
      stripeSubscriptionId: update.stripeSubscriptionId,
    });
    this.updates.push({ accountId, update });
    return Promise.resolve();
  }
}

export class InMemoryBillingEventRepository implements BillingEventRepository {
  private readonly processed = new Set<string>();
  readonly claimed: string[] = [];

  claim(event: ReceivedBillingEvent): Promise<boolean> {
    this.claimed.push(event.id);
    return Promise.resolve(!this.processed.has(event.id));
  }

  complete(eventId: string): Promise<void> {
    this.processed.add(eventId);
    return Promise.resolve();
  }
}

import type { AccountStatus } from '../domain/accounts/account-status';
import type {
  AccountWelcomeRepository,
  WelcomeTarget,
} from '../domain/repositories/account-welcome.repository';

const WELCOMED_STATUSES: ReadonlySet<AccountStatus> = new Set([
  'trialing',
  'active',
  'past_due',
  'ending',
  'free',
]);

interface StoredWelcome {
  readonly target: WelcomeTarget;
  readonly signedUp: boolean;
  welcomedAt: Date | null;
}

export class InMemoryAccountWelcomeRepository implements AccountWelcomeRepository {
  private readonly accounts = new Map<string, StoredWelcome>();

  add(target: WelcomeTarget, signedUp = true): void {
    this.accounts.set(target.accountId, { target, signedUp, welcomedAt: null });
  }

  welcomedAt(accountId: string): Date | null | undefined {
    return this.accounts.get(accountId)?.welcomedAt;
  }

  toWelcome(accountId: string): Promise<WelcomeTarget | null> {
    const stored = this.accounts.get(accountId);
    return Promise.resolve(stored !== undefined && this.waiting(stored) ? stored.target : null);
  }

  pendingWelcomes(): Promise<readonly WelcomeTarget[]> {
    return Promise.resolve(
      [...this.accounts.values()]
        .filter((stored) => stored.signedUp && this.waiting(stored))
        .map((stored) => stored.target),
    );
  }

  markWelcomed(accountId: string, at: Date): Promise<void> {
    const stored = this.accounts.get(accountId);
    if (stored !== undefined) {
      stored.welcomedAt = at;
    }
    return Promise.resolve();
  }

  private waiting(stored: StoredWelcome): boolean {
    return stored.welcomedAt === null && WELCOMED_STATUSES.has(stored.target.status);
  }
}

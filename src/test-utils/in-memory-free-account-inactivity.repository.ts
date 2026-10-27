import type {
  FreeAccountInactivityRepository,
  FreeAccountToSweep,
} from '../domain/repositories/free-account-inactivity.repository';

export class InMemoryFreeAccountInactivityRepository implements FreeAccountInactivityRepository {
  private readonly accounts = new Map<string, FreeAccountToSweep>();

  add(account: FreeAccountToSweep): void {
    this.accounts.set(account.accountId, account);
  }

  notifiedAt(accountId: string): Date | null | undefined {
    return this.accounts.get(accountId)?.inactivityNotifiedAt;
  }

  freeAccounts(): Promise<readonly FreeAccountToSweep[]> {
    return Promise.resolve([...this.accounts.values()]);
  }

  markNotified(accountId: string, at: Date): Promise<void> {
    this.setNotice(accountId, at);
    return Promise.resolve();
  }

  clearNotice(accountId: string): Promise<void> {
    this.setNotice(accountId, null);
    return Promise.resolve();
  }

  private setNotice(accountId: string, at: Date | null): void {
    const account = this.accounts.get(accountId);
    if (account !== undefined) {
      this.accounts.set(accountId, { ...account, inactivityNotifiedAt: at });
    }
  }
}

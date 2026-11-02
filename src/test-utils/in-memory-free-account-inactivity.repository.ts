import type {
  FreeAccountInactivityRepository,
  FreeAccountToSweep,
} from '../domain/repositories/free-account-inactivity.repository';

type AccountMarks = Pick<FreeAccountToSweep, 'inactivityNotifiedAt' | 'installRemindedAt'>;

export class InMemoryFreeAccountInactivityRepository implements FreeAccountInactivityRepository {
  private readonly accounts = new Map<string, FreeAccountToSweep>();

  add(account: FreeAccountToSweep): void {
    this.accounts.set(account.accountId, account);
  }

  notifiedAt(accountId: string): Date | null | undefined {
    return this.accounts.get(accountId)?.inactivityNotifiedAt;
  }

  installRemindedAt(accountId: string): Date | null | undefined {
    return this.accounts.get(accountId)?.installRemindedAt;
  }

  freeAccounts(): Promise<readonly FreeAccountToSweep[]> {
    return Promise.resolve([...this.accounts.values()]);
  }

  markNotified(accountId: string, at: Date): Promise<void> {
    this.mark(accountId, { inactivityNotifiedAt: at });
    return Promise.resolve();
  }

  clearNotice(accountId: string): Promise<void> {
    this.mark(accountId, { inactivityNotifiedAt: null });
    return Promise.resolve();
  }

  markInstallReminded(accountId: string, at: Date): Promise<void> {
    this.mark(accountId, { installRemindedAt: at });
    return Promise.resolve();
  }

  private mark(accountId: string, marks: Partial<AccountMarks>): void {
    const account = this.accounts.get(accountId);
    if (account !== undefined) {
      this.accounts.set(accountId, { ...account, ...marks });
    }
  }
}

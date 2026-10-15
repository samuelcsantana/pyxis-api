import type { AccountStatus } from '../domain/accounts/account-status';
import type { EmailLanguage } from '../domain/auth/email-language';
import type {
  AccountLifecycleRepository,
  EndedAccount,
  ReconcilableAccount,
  StaleAccount,
} from '../domain/repositories/account-lifecycle.repository';

const RECONCILED_STATUSES: ReadonlySet<AccountStatus> = new Set([
  'trialing',
  'active',
  'past_due',
  'ending',
]);

export interface LifecycleAccount {
  readonly accountId: string;
  readonly ownerAdminId: string;
  readonly ownerEmail: string;
  readonly ownerLanguage: EmailLanguage;
  readonly status: AccountStatus;
  readonly accessEndsAt: Date | null;
  readonly subscriptionId: string | null;
  readonly createdAt: Date;
  readonly keysRevokedAt: Date | null;
  readonly endedNotifiedAt: Date | null;
  readonly deletionRemindedAt: Date | null;
  readonly deletionHeldAt: Date | null;
}

const CREATED_AT = new Date('2026-10-01T00:00:00.000Z');

export class InMemoryAccountLifecycleRepository implements AccountLifecycleRepository {
  private readonly accounts = new Map<string, LifecycleAccount>();
  private readonly projects = new Map<string, string>();
  private readonly events = new Map<string, number>();
  private readonly liveKeys = new Map<string, number>();
  private access: readonly { readonly adminUserId: string; readonly projectId: string }[] = [];
  private readonly admins = new Set<string>();
  private readonly heldProjects = new Set<string>();
  readonly failingProjects = new Set<string>();
  readonly failingAccounts = new Set<string>();
  readonly eventBatches: number[] = [];

  add(account: Partial<LifecycleAccount> & Pick<LifecycleAccount, 'accountId'>): void {
    const ownerAdminId = account.ownerAdminId ?? `owner-of-${account.accountId}`;
    this.admins.add(ownerAdminId);
    this.accounts.set(account.accountId, {
      ownerAdminId,
      ownerEmail: `${ownerAdminId}@example.com`,
      ownerLanguage: 'en',
      status: 'active',
      accessEndsAt: null,
      subscriptionId: null,
      createdAt: CREATED_AT,
      keysRevokedAt: null,
      endedNotifiedAt: null,
      deletionRemindedAt: null,
      deletionHeldAt: null,
      ...account,
    });
  }

  addProject(projectId: string, accountId: string, events: number, keys = 1): void {
    this.projects.set(projectId, accountId);
    this.events.set(projectId, events);
    this.liveKeys.set(projectId, keys);
  }

  holdProject(projectId: string): void {
    this.heldProjects.add(projectId);
  }

  releaseProject(projectId: string): void {
    this.heldProjects.delete(projectId);
  }

  grant(adminUserId: string, projectId: string): void {
    this.admins.add(adminUserId);
    this.access = [...this.access, { adminUserId, projectId }];
  }

  account(accountId: string): LifecycleAccount | undefined {
    return this.accounts.get(accountId);
  }

  liveKeysOf(projectId: string): number | undefined {
    return this.liveKeys.get(projectId);
  }

  hasProject(projectId: string): boolean {
    return this.projects.has(projectId);
  }

  hasAdmin(adminUserId: string): boolean {
    return this.admins.has(adminUserId);
  }

  reconcilable(): Promise<readonly ReconcilableAccount[]> {
    return Promise.resolve(
      [...this.accounts.values()].flatMap((account) =>
        account.subscriptionId !== null && RECONCILED_STATUSES.has(account.status)
          ? [
              {
                accountId: account.accountId,
                status: account.status,
                accessEndsAt: account.accessEndsAt,
                subscriptionId: account.subscriptionId,
              },
            ]
          : [],
      ),
    );
  }

  revokeKeysOfEndedAccounts(now: Date): Promise<number> {
    const due = this.endedWhere(
      (account, accessEndsAt) => accessEndsAt <= now && account.keysRevokedAt === null,
    );
    for (const account of due) {
      for (const [projectId, accountId] of this.projects) {
        if (accountId === account.accountId) {
          this.liveKeys.set(projectId, 0);
        }
      }
      this.update(account.accountId, { keysRevokedAt: now });
    }
    return Promise.resolve(due.length);
  }

  endedToNotify(now: Date): Promise<readonly EndedAccount[]> {
    return Promise.resolve(
      this.endedWhere(
        (account, accessEndsAt) => accessEndsAt <= now && account.endedNotifiedAt === null,
      ),
    );
  }

  markEndedNotified(accountId: string, at: Date): Promise<void> {
    this.update(accountId, { endedNotifiedAt: at });
    return Promise.resolve();
  }

  dueForReminder(remindBefore: Date, deleteBefore: Date): Promise<readonly EndedAccount[]> {
    return Promise.resolve(
      this.endedWhere(
        (account, accessEndsAt) =>
          accessEndsAt <= remindBefore &&
          accessEndsAt > deleteBefore &&
          account.deletionRemindedAt === null &&
          account.deletionHeldAt === null,
      ),
    );
  }

  markReminded(accountId: string, at: Date): Promise<void> {
    this.update(accountId, { deletionRemindedAt: at });
    return Promise.resolve();
  }

  dueForDeletion(deleteBefore: Date): Promise<readonly EndedAccount[]> {
    return Promise.resolve(
      this.endedWhere(
        (account, accessEndsAt) => accessEndsAt <= deleteBefore && account.deletionHeldAt === null,
      ),
    );
  }

  staleIncomplete(createdBefore: Date): Promise<readonly StaleAccount[]> {
    const holding = new Set(this.projects.values());
    return Promise.resolve(
      [...this.accounts.values()]
        .filter(
          (account) =>
            account.status === 'incomplete' &&
            account.subscriptionId === null &&
            account.createdAt < createdBefore &&
            account.deletionHeldAt === null &&
            !holding.has(account.accountId),
        )
        .map(({ accountId, ownerAdminId }) => ({ accountId, ownerAdminId })),
    );
  }

  peopleOf(accountId: string): Promise<readonly string[]> {
    return Promise.resolve([
      ...new Set(
        this.access
          .filter((entry) => this.projects.get(entry.projectId) === accountId)
          .map((entry) => entry.adminUserId),
      ),
    ]);
  }

  projectIdsOf(accountId: string): Promise<readonly string[]> {
    return Promise.resolve(
      [...this.projects].filter(([, owner]) => owner === accountId).map(([projectId]) => projectId),
    );
  }

  heldProjectIdsOf(accountId: string): Promise<readonly string[]> {
    return Promise.resolve(
      [...this.projects]
        .filter(([projectId, owner]) => owner === accountId && this.heldProjects.has(projectId))
        .map(([projectId]) => projectId),
    );
  }

  deleteEventsOf(projectId: string, limit: number): Promise<number> {
    const remaining = this.events.get(projectId) ?? 0;
    const deleted = Math.min(remaining, limit);
    this.events.set(projectId, remaining - deleted);
    this.eventBatches.push(deleted);
    return Promise.resolve(deleted);
  }

  deleteProject(projectId: string): Promise<void> {
    if (this.failingProjects.has(projectId)) {
      return Promise.reject(new Error(`could not delete ${projectId}`));
    }
    this.projects.delete(projectId);
    this.events.delete(projectId);
    this.liveKeys.delete(projectId);
    this.access = this.access.filter((entry) => entry.projectId !== projectId);
    return Promise.resolve();
  }

  deleteAccount(accountId: string): Promise<void> {
    if (this.failingAccounts.has(accountId) || [...this.projects.values()].includes(accountId)) {
      return Promise.reject(new Error(`account ${accountId} still holds projects`));
    }
    this.accounts.delete(accountId);
    return Promise.resolve();
  }

  deleteAdminsLeftWithout(adminUserIds: readonly string[]): Promise<number> {
    const owners = new Set([...this.accounts.values()].map((account) => account.ownerAdminId));
    const reading = new Set(this.access.map((entry) => entry.adminUserId));
    const removable = adminUserIds.filter(
      (adminUserId) =>
        this.admins.has(adminUserId) && !owners.has(adminUserId) && !reading.has(adminUserId),
    );
    for (const adminUserId of removable) {
      this.admins.delete(adminUserId);
    }
    return Promise.resolve(removable.length);
  }

  private endedWhere(
    matches: (account: LifecycleAccount, accessEndsAt: Date) => boolean,
  ): EndedAccount[] {
    return [...this.accounts.values()].flatMap((account) =>
      account.status === 'ended' &&
      account.accessEndsAt !== null &&
      matches(account, account.accessEndsAt)
        ? [
            {
              accountId: account.accountId,
              ownerAdminId: account.ownerAdminId,
              ownerEmail: account.ownerEmail,
              ownerLanguage: account.ownerLanguage,
              accessEndsAt: account.accessEndsAt,
            },
          ]
        : [],
    );
  }

  private update(accountId: string, changes: Partial<LifecycleAccount>): void {
    const account = this.accounts.get(accountId);
    if (account !== undefined) {
      this.accounts.set(accountId, { ...account, ...changes });
    }
  }
}

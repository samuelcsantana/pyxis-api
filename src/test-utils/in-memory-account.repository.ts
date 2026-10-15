import type { Account } from '../domain/entities/account.entity';
import type { Project } from '../domain/entities/project.entity';
import type { PlanLimitChanges } from '../domain/accounts/account-limits';
import type { AccountDeletionHoldRepository } from '../domain/repositories/account-deletion-hold.repository';
import type { AccountPlanLimitsRepository } from '../domain/repositories/account-plan-limits.repository';
import type { AccountQuotaExemptionRepository } from '../domain/repositories/account-quota-exemption.repository';
import type { AccountSuspensionRepository } from '../domain/repositories/account-suspension.repository';
import type {
  AccountMembership,
  AccountOverview,
  AccountRepository,
  NewAccount,
} from '../domain/repositories/account.repository';
import type { InMemoryAdminUserRepository } from './in-memory-admin-user.repository';

const CREATED_AT = new Date('2026-10-14T00:00:00.000Z');

export interface AccountMembers {
  readonly projects: readonly Project[];
  readonly people: number;
}

const NO_MEMBERS: AccountMembers = { projects: [], people: 0 };

export class InMemoryAccountRepository
  implements
    AccountRepository,
    AccountSuspensionRepository,
    AccountDeletionHoldRepository,
    AccountQuotaExemptionRepository,
    AccountPlanLimitsRepository
{
  private readonly accounts = new Map<string, Account>();
  private readonly memberships = new Map<string, AccountMembers>();
  private readonly members: { readonly account: Account; readonly adminUserId: string }[] = [];

  constructor(private readonly admins: InMemoryAdminUserRepository) {}

  get stored(): readonly Account[] {
    return [...this.accounts.values()];
  }

  addMember(account: Account, adminUserId: string): void {
    this.members.push({ account, adminUserId });
  }

  add(account: Account, membership: AccountMembers = NO_MEMBERS): void {
    this.accounts.set(account.id, account);
    this.memberships.set(account.id, membership);
  }

  create(account: NewAccount): Promise<Account> {
    const created: Account = {
      ...account,
      ingestionPausedUntil: null,
      stripeCustomerId: null,
      billingInterval: null,
      trialEndsAt: null,
      currentPeriodEndsAt: null,
      accessEndsAt: null,
      suspendedAt: null,
      suspensionReason: null,
      deletionHeldAt: null,
      deletionHoldReason: null,
      quotaPauseExemptUntil: null,
      eventsPerMonthLimit: null,
      projectsLimit: null,
      peopleLimit: null,
      id: `acc00000-0000-4000-a000-${String(this.accounts.size + 1).padStart(12, '0')}`,
      createdAt: CREATED_AT,
    };
    this.add(created);
    return Promise.resolve(created);
  }

  suspend(accountId: string, reason: string, at: Date): Promise<Account | null> {
    return Promise.resolve(this.change(accountId, { suspendedAt: at, suspensionReason: reason }));
  }

  resume(accountId: string): Promise<Account | null> {
    return Promise.resolve(this.change(accountId, { suspendedAt: null, suspensionReason: null }));
  }

  hold(accountId: string, reason: string, at: Date): Promise<Account | null> {
    return Promise.resolve(
      this.change(accountId, { deletionHeldAt: at, deletionHoldReason: reason }),
    );
  }

  release(accountId: string): Promise<Account | null> {
    return Promise.resolve(
      this.change(accountId, { deletionHeldAt: null, deletionHoldReason: null }),
    );
  }

  exemptFromPause(accountId: string, until: Date): Promise<Account | null> {
    return Promise.resolve(
      this.change(accountId, { quotaPauseExemptUntil: until, ingestionPausedUntil: null }),
    );
  }

  endPauseExemption(accountId: string): Promise<Account | null> {
    return Promise.resolve(this.change(accountId, { quotaPauseExemptUntil: null }));
  }

  setPlanLimits(accountId: string, changes: PlanLimitChanges): Promise<Account | null> {
    return Promise.resolve(this.change(accountId, changes));
  }

  private change(accountId: string, changes: Partial<Account>): Account | null {
    const account = this.accounts.get(accountId);
    if (account === undefined) {
      return null;
    }
    const changed = { ...account, ...changes };
    this.accounts.set(accountId, changed);
    return changed;
  }

  findById(accountId: string): Promise<Account | null> {
    return Promise.resolve(this.accounts.get(accountId) ?? null);
  }

  projectsOf(accountId: string): Promise<readonly Project[]> {
    return Promise.resolve(this.membershipOf(accountId).projects);
  }

  peopleCount(accountId: string): Promise<number> {
    return Promise.resolve(this.membershipOf(accountId).people);
  }

  async overviewOf(accountId: string): Promise<AccountOverview | null> {
    const account = this.accounts.get(accountId);
    if (account === undefined) {
      return null;
    }
    const owner = await this.admins.findById(account.ownerAdminId);
    if (owner === null) {
      return null;
    }
    const { projects, people } = this.membershipOf(accountId);
    return { account, ownerEmail: owner.email, projects, people };
  }

  liveAccountOwnedBy(adminUserId: string): Promise<Account | null> {
    const live = this.stored.filter(
      (account) => account.ownerAdminId === adminUserId && account.status !== 'ended',
    );
    return Promise.resolve(live.at(-1) ?? null);
  }

  membershipsOf(adminUserId: string): Promise<readonly AccountMembership[]> {
    const owned = this.stored
      .filter((account) => account.ownerAdminId === adminUserId)
      .map((account) => ({ account, role: 'owner' as const }));
    const joined = this.members
      .filter((member) => member.adminUserId === adminUserId)
      .map((member) => ({ account: member.account, role: 'member' as const }));
    return Promise.resolve([...owned, ...joined]);
  }

  private membershipOf(accountId: string): AccountMembers {
    return this.memberships.get(accountId) ?? NO_MEMBERS;
  }
}

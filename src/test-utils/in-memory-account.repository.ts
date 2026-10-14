import type { Account } from '../domain/entities/account.entity';
import type { Project } from '../domain/entities/project.entity';
import type {
  AccountOverview,
  AccountRepository,
  NewAccount,
} from '../domain/repositories/account.repository';
import type { InMemoryAdminUserRepository } from './in-memory-admin-user.repository';

const CREATED_AT = new Date('2026-10-14T00:00:00.000Z');

export interface AccountMembership {
  readonly projects: readonly Project[];
  readonly people: number;
}

const NO_MEMBERS: AccountMembership = { projects: [], people: 0 };

export class InMemoryAccountRepository implements AccountRepository {
  private readonly accounts = new Map<string, Account>();
  private readonly memberships = new Map<string, AccountMembership>();

  constructor(private readonly admins: InMemoryAdminUserRepository) {}

  get stored(): readonly Account[] {
    return [...this.accounts.values()];
  }

  add(account: Account, membership: AccountMembership = NO_MEMBERS): void {
    this.accounts.set(account.id, account);
    this.memberships.set(account.id, membership);
  }

  create(account: NewAccount): Promise<Account> {
    const created: Account = {
      ...account,
      id: `acc00000-0000-4000-a000-${String(this.accounts.size + 1).padStart(12, '0')}`,
      createdAt: CREATED_AT,
    };
    this.add(created);
    return Promise.resolve(created);
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

  private membershipOf(accountId: string): AccountMembership {
    return this.memberships.get(accountId) ?? NO_MEMBERS;
  }
}

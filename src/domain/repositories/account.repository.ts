import type { AccountStatus } from '../accounts/account-status';
import type { Account } from '../entities/account.entity';
import type { Project } from '../entities/project.entity';

export interface NewAccount {
  readonly ownerAdminId: string;
  readonly status: AccountStatus;
}

export interface FreePlaceClaim {
  readonly ownerAdminId: string;
  readonly accountId: string | null;
  readonly freeAccountsMax: number;
  readonly at: Date;
}

export interface AccountOverview {
  readonly account: Account;
  readonly ownerEmail: string;
  readonly projects: readonly Project[];
  readonly people: number;
}

export type AccountRole = 'owner' | 'member';

export interface AccountMembership {
  readonly account: Account;
  readonly role: AccountRole;
}

export interface AccountRepository {
  create(account: NewAccount): Promise<Account>;
  claimFreePlace(claim: FreePlaceClaim): Promise<Account>;
  findById(accountId: string): Promise<Account | null>;
  projectsOf(accountId: string): Promise<readonly Project[]>;
  peopleCount(accountId: string): Promise<number>;
  overviewOf(accountId: string): Promise<AccountOverview | null>;
  liveAccountOwnedBy(adminUserId: string): Promise<Account | null>;
  membershipsOf(adminUserId: string): Promise<readonly AccountMembership[]>;
}

export const ACCOUNT_REPOSITORY = Symbol('AccountRepository');

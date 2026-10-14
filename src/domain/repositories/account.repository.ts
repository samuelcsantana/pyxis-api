import type { AccountStatus } from '../accounts/account-status';
import type { Account } from '../entities/account.entity';
import type { Project } from '../entities/project.entity';

export interface NewAccount {
  readonly ownerAdminId: string;
  readonly status: AccountStatus;
}

export interface AccountRepository {
  create(account: NewAccount): Promise<Account>;
  findById(accountId: string): Promise<Account | null>;
  projectsOf(accountId: string): Promise<readonly Project[]>;
  peopleCount(accountId: string): Promise<number>;
}

export const ACCOUNT_REPOSITORY = Symbol('AccountRepository');

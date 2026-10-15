import { hasAccess } from '../../domain/accounts/account-status';
import { isSuspended } from '../../domain/accounts/account-suspension';
import type { Account } from '../../domain/entities/account.entity';
import type { Project } from '../../domain/entities/project.entity';
import {
  AccountSuspendedError,
  SubscriptionRequiredError,
} from '../../domain/errors/account.errors';
import { ProjectNotFoundError } from '../../domain/errors/project.errors';
import type { AccountRepository } from '../../domain/repositories/account.repository';
import type { ProjectSettingsRepository } from '../../domain/repositories/project-settings.repository';

export interface OwnedProject {
  readonly project: Project;
  readonly account: Account;
}

export async function projectOwnedBy(
  projects: ProjectSettingsRepository,
  accounts: AccountRepository,
  projectId: string,
  adminUserId: string,
): Promise<OwnedProject> {
  const project = await projects.findById(projectId);
  const accountId = project === null ? null : await projects.accountIdOf(project.id);
  const account = accountId === null ? null : await accounts.findById(accountId);
  if (project === null || account?.ownerAdminId !== adminUserId) {
    throw new ProjectNotFoundError();
  }
  return { project, account };
}

export function requireAccess(account: Account): void {
  if (isSuspended(account)) {
    throw new AccountSuspendedError();
  }
  if (!hasAccess(account.status)) {
    throw new SubscriptionRequiredError();
  }
}

export async function changeableProject(
  projects: ProjectSettingsRepository,
  accounts: AccountRepository,
  projectId: string,
  adminUserId: string,
): Promise<OwnedProject> {
  const owned = await projectOwnedBy(projects, accounts, projectId, adminUserId);
  requireAccess(owned.account);
  return owned;
}

export async function ownerOfProject(
  projects: ProjectSettingsRepository,
  accounts: AccountRepository,
  projectId: string,
): Promise<string | null> {
  const accountId = await projects.accountIdOf(projectId);
  const account = accountId === null ? null : await accounts.findById(accountId);
  return account?.ownerAdminId ?? null;
}

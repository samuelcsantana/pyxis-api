import { Inject, Injectable } from '@nestjs/common';
import { isDeletionHeld } from '../../domain/accounts/account-deletion-hold';
import { DeletionOnHoldError } from '../../domain/errors/account.errors';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import { isProjectDeletionHeld } from '../../domain/projects/project-deletion-hold';
import {
  PROJECT_DELETION_HOLD_REPOSITORY,
  type ProjectDeletionHoldRepository,
} from '../../domain/repositories/project-deletion-hold.repository';
import {
  type DeletedProject,
  PROJECT_SETTINGS_REPOSITORY,
  type ProjectSettingsRepository,
} from '../../domain/repositories/project-settings.repository';
import { type DeleteProjectCommand, DeleteProjectUseCase } from './delete-project.usecase';
import { projectOwnedBy } from './owned-project';

export interface DeleteOwnedProjectCommand extends DeleteProjectCommand {
  readonly adminUserId: string;
}

@Injectable()
export class DeleteOwnedProjectUseCase {
  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(PROJECT_DELETION_HOLD_REPOSITORY)
    private readonly holds: ProjectDeletionHoldRepository,
    private readonly deleteProject: DeleteProjectUseCase,
  ) {}

  async execute(command: DeleteOwnedProjectCommand): Promise<DeletedProject> {
    const { adminUserId, ...deletion } = command;
    const { account } = await projectOwnedBy(
      this.projects,
      this.accounts,
      deletion.projectId,
      adminUserId,
    );
    if (
      isDeletionHeld(account) ||
      isProjectDeletionHeld(await this.holds.holdOf(deletion.projectId))
    ) {
      throw new DeletionOnHoldError();
    }
    return this.deleteProject.execute(deletion);
  }
}

import { Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
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
    private readonly deleteProject: DeleteProjectUseCase,
  ) {}

  async execute(command: DeleteOwnedProjectCommand): Promise<DeletedProject> {
    const { adminUserId, ...deletion } = command;
    await projectOwnedBy(this.projects, this.accounts, deletion.projectId, adminUserId);
    return this.deleteProject.execute(deletion);
  }
}

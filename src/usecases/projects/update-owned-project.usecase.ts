import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import {
  PROJECT_SETTINGS_REPOSITORY,
  type ProjectSettingsRepository,
} from '../../domain/repositories/project-settings.repository';
import { changeableProject } from './owned-project';
import { type UpdateProjectCommand, UpdateProjectUseCase } from './update-project.usecase';

export interface UpdateOwnedProjectCommand extends UpdateProjectCommand {
  readonly adminUserId: string;
}

@Injectable()
export class UpdateOwnedProjectUseCase {
  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    private readonly updateProject: UpdateProjectUseCase,
  ) {}

  async execute(command: UpdateOwnedProjectCommand): Promise<Project> {
    const { adminUserId, ...changes } = command;
    await changeableProject(this.projects, this.accounts, changes.projectId, adminUserId);
    return this.updateProject.execute(changes);
  }
}

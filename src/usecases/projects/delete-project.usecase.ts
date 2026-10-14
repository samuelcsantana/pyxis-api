import { Inject, Injectable } from '@nestjs/common';
import { ProjectNameMismatchError, ProjectNotFoundError } from '../../domain/errors/project.errors';
import {
  type DeletedProject,
  PROJECT_SETTINGS_REPOSITORY,
  type ProjectSettingsRepository,
} from '../../domain/repositories/project-settings.repository';

export interface DeleteProjectCommand {
  readonly projectId: string;
  readonly confirmName: string;
}

@Injectable()
export class DeleteProjectUseCase {
  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
  ) {}

  async execute(command: DeleteProjectCommand): Promise<DeletedProject> {
    const project = await this.projects.findById(command.projectId);
    if (project === null) {
      throw new ProjectNotFoundError();
    }
    if (project.name !== command.confirmName) {
      throw new ProjectNameMismatchError();
    }
    const deleted = await this.projects.deleteWithEverything(command.projectId);
    if (deleted === null) {
      throw new ProjectNotFoundError();
    }
    return deleted;
  }
}

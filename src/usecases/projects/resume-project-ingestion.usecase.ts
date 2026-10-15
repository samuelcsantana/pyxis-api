import { Inject, Injectable } from '@nestjs/common';
import { ProjectNotFoundError } from '../../domain/errors/project.errors';
import {
  PROJECT_SUSPENSION_REPOSITORY,
  type ProjectIngestionSuspension,
  type ProjectSuspensionRepository,
} from '../../domain/repositories/project-suspension.repository';

export interface ResumeProjectIngestionCommand {
  readonly projectId: string;
}

@Injectable()
export class ResumeProjectIngestionUseCase {
  constructor(
    @Inject(PROJECT_SUSPENSION_REPOSITORY)
    private readonly suspensions: ProjectSuspensionRepository,
  ) {}

  async execute(command: ResumeProjectIngestionCommand): Promise<ProjectIngestionSuspension> {
    const resumed = await this.suspensions.resume(command.projectId);
    if (resumed === null) {
      throw new ProjectNotFoundError();
    }
    return resumed;
  }
}

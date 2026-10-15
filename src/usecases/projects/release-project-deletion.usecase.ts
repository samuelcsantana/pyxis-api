import { Inject, Injectable } from '@nestjs/common';
import { ProjectNotFoundError } from '../../domain/errors/project.errors';
import {
  PROJECT_DELETION_HOLD_REPOSITORY,
  type ProjectDeletionHold,
  type ProjectDeletionHoldRepository,
} from '../../domain/repositories/project-deletion-hold.repository';

export interface ReleaseProjectDeletionCommand {
  readonly projectId: string;
}

@Injectable()
export class ReleaseProjectDeletionUseCase {
  constructor(
    @Inject(PROJECT_DELETION_HOLD_REPOSITORY)
    private readonly holds: ProjectDeletionHoldRepository,
  ) {}

  async execute(command: ReleaseProjectDeletionCommand): Promise<ProjectDeletionHold> {
    const released = await this.holds.release(command.projectId);
    if (released === null) {
      throw new ProjectNotFoundError();
    }
    return released;
  }
}

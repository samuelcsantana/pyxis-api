import { Inject, Injectable } from '@nestjs/common';
import { ProjectNotFoundError } from '../../domain/errors/project.errors';
import {
  PROJECT_SUSPENSION_REPOSITORY,
  type ProjectIngestionSuspension,
  type ProjectSuspensionRepository,
} from '../../domain/repositories/project-suspension.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

export interface SuspendedProjectIngestion extends ProjectIngestionSuspension {
  readonly suspendedAt: Date;
  readonly reason: string;
}

export interface SuspendProjectIngestionCommand {
  readonly projectId: string;
  readonly reason: string;
}

@Injectable()
export class SuspendProjectIngestionUseCase {
  constructor(
    @Inject(PROJECT_SUSPENSION_REPOSITORY)
    private readonly suspensions: ProjectSuspensionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: SuspendProjectIngestionCommand): Promise<SuspendedProjectIngestion> {
    const current = await this.suspensions.suspensionOf(command.projectId);
    if (current === null) {
      throw new ProjectNotFoundError();
    }
    const suspendedAt = current.suspendedAt ?? this.clock.now();
    const suspended = await this.suspensions.suspend(
      command.projectId,
      command.reason,
      suspendedAt,
    );
    if (suspended === null) {
      throw new ProjectNotFoundError();
    }
    return { ...suspended, suspendedAt, reason: command.reason };
  }
}

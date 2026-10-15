import { Inject, Injectable } from '@nestjs/common';
import { ProjectNotFoundError } from '../../domain/errors/project.errors';
import {
  PROJECT_DELETION_HOLD_REPOSITORY,
  type ProjectDeletionHold,
  type ProjectDeletionHoldRepository,
} from '../../domain/repositories/project-deletion-hold.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

export interface HeldProjectDeletion extends ProjectDeletionHold {
  readonly heldAt: Date;
  readonly reason: string;
}

export interface HoldProjectDeletionCommand {
  readonly projectId: string;
  readonly reason: string;
}

@Injectable()
export class HoldProjectDeletionUseCase {
  constructor(
    @Inject(PROJECT_DELETION_HOLD_REPOSITORY)
    private readonly holds: ProjectDeletionHoldRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: HoldProjectDeletionCommand): Promise<HeldProjectDeletion> {
    const current = await this.holds.holdOf(command.projectId);
    if (current === null) {
      throw new ProjectNotFoundError();
    }
    const heldAt = current.heldAt ?? this.clock.now();
    const held = await this.holds.hold(command.projectId, command.reason, heldAt);
    if (held === null) {
      throw new ProjectNotFoundError();
    }
    return { ...held, heldAt, reason: command.reason };
  }
}

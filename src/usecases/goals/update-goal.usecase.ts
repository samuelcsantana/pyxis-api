import { Inject, Injectable } from '@nestjs/common';
import { GoalNotFoundError } from '../../domain/errors/goal.errors';
import {
  type Goal,
  type GoalChanges,
  type GoalTarget,
  requireGoalName,
  requireGoalTarget,
} from '../../domain/goals/goal';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import { GOAL_REPOSITORY, type GoalRepository } from '../../domain/repositories/goal.repository';
import {
  PROJECT_SETTINGS_REPOSITORY,
  type ProjectSettingsRepository,
} from '../../domain/repositories/project-settings.repository';
import { changeableProject } from '../projects/owned-project';

export interface UpdateGoalCommand {
  readonly adminUserId: string;
  readonly projectId: string;
  readonly goalId: string;
  readonly name?: string;
  readonly target?: GoalTarget;
}

function validatedChanges(command: UpdateGoalCommand): GoalChanges {
  return {
    ...(command.name === undefined ? {} : { name: requireGoalName(command.name) }),
    ...(command.target === undefined ? {} : { target: requireGoalTarget(command.target) }),
  };
}

@Injectable()
export class UpdateGoalUseCase {
  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(GOAL_REPOSITORY) private readonly goals: GoalRepository,
  ) {}

  async execute(command: UpdateGoalCommand): Promise<Goal> {
    const changes = validatedChanges(command);
    await changeableProject(this.projects, this.accounts, command.projectId, command.adminUserId);
    const updated = await this.goals.update(command.projectId, command.goalId, changes);
    if (updated === null) {
      throw new GoalNotFoundError();
    }
    return updated;
  }
}

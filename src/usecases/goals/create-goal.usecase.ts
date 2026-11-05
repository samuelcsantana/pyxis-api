import { Inject, Injectable } from '@nestjs/common';
import { GoalLimitReachedError } from '../../domain/errors/goal.errors';
import {
  type Goal,
  type GoalTarget,
  MAX_GOALS,
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

export interface CreateGoalCommand {
  readonly adminUserId: string;
  readonly projectId: string;
  readonly name: string;
  readonly target: GoalTarget;
}

@Injectable()
export class CreateGoalUseCase {
  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(GOAL_REPOSITORY) private readonly goals: GoalRepository,
  ) {}

  async execute(command: CreateGoalCommand): Promise<Goal> {
    const draft = {
      name: requireGoalName(command.name),
      target: requireGoalTarget(command.target),
    };
    await changeableProject(this.projects, this.accounts, command.projectId, command.adminUserId);
    const created = await this.goals.create(command.projectId, draft, MAX_GOALS);
    if (created.outcome === 'limit_reached') {
      throw new GoalLimitReachedError(MAX_GOALS);
    }
    return created.goal;
  }
}

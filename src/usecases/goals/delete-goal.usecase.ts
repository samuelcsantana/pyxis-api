import { Inject, Injectable } from '@nestjs/common';
import { GoalNotFoundError } from '../../domain/errors/goal.errors';
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

export interface DeleteGoalCommand {
  readonly adminUserId: string;
  readonly projectId: string;
  readonly goalId: string;
}

@Injectable()
export class DeleteGoalUseCase {
  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(GOAL_REPOSITORY) private readonly goals: GoalRepository,
  ) {}

  async execute(command: DeleteGoalCommand): Promise<void> {
    await changeableProject(this.projects, this.accounts, command.projectId, command.adminUserId);
    if (!(await this.goals.delete(command.projectId, command.goalId))) {
      throw new GoalNotFoundError();
    }
  }
}

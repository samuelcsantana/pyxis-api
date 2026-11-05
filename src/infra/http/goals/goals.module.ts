import { Module } from '@nestjs/common';
import { GOALS_SUMMARY_QUERY } from '../../../domain/queries/goals-summary';
import { ACCOUNT_REPOSITORY } from '../../../domain/repositories/account.repository';
import { PROJECT_SETTINGS_REPOSITORY } from '../../../domain/repositories/project-settings.repository';
import { CreateGoalUseCase } from '../../../usecases/goals/create-goal.usecase';
import { DeleteGoalUseCase } from '../../../usecases/goals/delete-goal.usecase';
import { UpdateGoalUseCase } from '../../../usecases/goals/update-goal.usecase';
import { GetGoalsSummaryUseCase } from '../../../usecases/queries/get-goals-summary.usecase';
import { DrizzleGoalsSummaryQuery } from '../../queries/drizzle-goals-summary.query';
import { DrizzleAccountRepository } from '../../repositories/drizzle-account.repository';
import { DrizzleProjectSettingsRepository } from '../../repositories/drizzle-project-settings.repository';
import { AccessTokenThrottlerGuard } from '../auth/access-token-throttler.guard';
import { DashboardOriginGuard, SessionGuard } from '../auth/auth.guards';
import { AuthModule } from '../auth/auth.module';
import { ReadAccessGuard } from '../auth/read-access.guard';
import { ProjectAccessGuard } from '../queries/project-access.guard';
import { GoalSettingsController } from './goal-settings.controller';
import { GoalsController } from './goals.controller';

@Module({
  imports: [AuthModule],
  controllers: [GoalsController, GoalSettingsController],
  providers: [
    GetGoalsSummaryUseCase,
    CreateGoalUseCase,
    UpdateGoalUseCase,
    DeleteGoalUseCase,
    { provide: GOALS_SUMMARY_QUERY, useClass: DrizzleGoalsSummaryQuery },
    { provide: PROJECT_SETTINGS_REPOSITORY, useClass: DrizzleProjectSettingsRepository },
    { provide: ACCOUNT_REPOSITORY, useClass: DrizzleAccountRepository },
    DashboardOriginGuard,
    SessionGuard,
    ReadAccessGuard,
    AccessTokenThrottlerGuard,
    ProjectAccessGuard,
  ],
})
export class GoalsModule {}

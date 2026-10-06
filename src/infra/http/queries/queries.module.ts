import { Module } from '@nestjs/common';
import { OVERVIEW_QUERY } from '../../../domain/queries/overview';
import { GetOverviewUseCase } from '../../../usecases/queries/get-overview.usecase';
import { DrizzleOverviewQuery } from '../../queries/drizzle-overview.query';
import { AuthModule } from '../auth/auth.module';
import { SessionGuard } from '../auth/auth.guards';
import { ProjectAccessGuard } from './project-access.guard';
import { QueriesController } from './queries.controller';

@Module({
  imports: [AuthModule],
  controllers: [QueriesController],
  providers: [
    GetOverviewUseCase,
    { provide: OVERVIEW_QUERY, useClass: DrizzleOverviewQuery },
    SessionGuard,
    ProjectAccessGuard,
  ],
})
export class QueriesModule {}

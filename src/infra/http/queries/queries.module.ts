import { Module } from '@nestjs/common';
import { ACQUISITION_QUERY } from '../../../domain/queries/acquisition';
import { DEVICES_QUERY } from '../../../domain/queries/devices';
import { FEATURES_QUERY } from '../../../domain/queries/features';
import { FUNNEL_QUERY } from '../../../domain/queries/funnel';
import { PROPERTY_BREAKDOWN_QUERY } from '../../../domain/queries/property-breakdown';
import { REQUESTS_QUERY } from '../../../domain/queries/requests';
import { TIMELINE_QUERY } from '../../../domain/queries/timeline';
import { TIME_OF_DAY_QUERY } from '../../../domain/queries/time-of-day';
import { OVERVIEW_QUERY } from '../../../domain/queries/overview';
import { PROJECT_ACTIVITY_QUERY } from '../../../domain/queries/project-activity';
import { VISITS_QUERY } from '../../../domain/queries/visits';
import { PROJECT_KEY_REPOSITORY } from '../../../domain/repositories/project-key.repository';
import { GetAcquisitionUseCase } from '../../../usecases/queries/get-acquisition.usecase';
import { GetDevicesUseCase } from '../../../usecases/queries/get-devices.usecase';
import { GetFeaturesUseCase } from '../../../usecases/queries/get-features.usecase';
import { GetFunnelSubjectsUseCase } from '../../../usecases/queries/get-funnel-subjects.usecase';
import { GetFunnelUseCase } from '../../../usecases/queries/get-funnel.usecase';
import { GetPropertyBreakdownUseCase } from '../../../usecases/queries/get-property-breakdown.usecase';
import { GetRequestsUseCase } from '../../../usecases/queries/get-requests.usecase';
import { GetTimelineUseCase } from '../../../usecases/queries/get-timeline.usecase';
import { GetTimeOfDayUseCase } from '../../../usecases/queries/get-time-of-day.usecase';
import { GetOverviewUseCase } from '../../../usecases/queries/get-overview.usecase';
import { GetVisitsUseCase } from '../../../usecases/queries/get-visits.usecase';
import { GetProjectSettingsUseCase } from '../../../usecases/projects/get-project-settings.usecase';
import { DrizzleAcquisitionQuery } from '../../queries/drizzle-acquisition.query';
import { DrizzleDevicesQuery } from '../../queries/drizzle-devices.query';
import { DrizzleFeaturesQuery } from '../../queries/drizzle-features.query';
import { DrizzleFunnelQuery } from '../../queries/drizzle-funnel.query';
import { DrizzlePropertyBreakdownQuery } from '../../queries/drizzle-property-breakdown.query';
import { DrizzleRequestsQuery } from '../../queries/drizzle-requests.query';
import { DrizzleTimelineQuery } from '../../queries/drizzle-timeline.query';
import { DrizzleTimeOfDayQuery } from '../../queries/drizzle-time-of-day.query';
import { DrizzleOverviewQuery } from '../../queries/drizzle-overview.query';
import { DrizzleProjectActivityQuery } from '../../queries/drizzle-project-activity.query';
import { DrizzleVisitsQuery } from '../../queries/drizzle-visits.query';
import { DrizzleProjectKeyRepository } from '../../repositories/drizzle-project-key.repository';
import { AuthModule } from '../auth/auth.module';
import { SessionGuard } from '../auth/auth.guards';
import { FunnelSubjectsController } from './funnel-subjects.controller';
import { ProjectAccessGuard } from './project-access.guard';
import { ProjectSettingsController } from './project-settings.controller';
import { PropertyBreakdownController } from './property-breakdown.controller';
import { QueriesController } from './queries.controller';
import { TimeOfDayController } from './time-of-day.controller';
import { VisitsController } from './visits.controller';

@Module({
  imports: [AuthModule],
  controllers: [
    QueriesController,
    PropertyBreakdownController,
    VisitsController,
    FunnelSubjectsController,
    ProjectSettingsController,
    TimeOfDayController,
  ],
  providers: [
    GetOverviewUseCase,
    { provide: OVERVIEW_QUERY, useClass: DrizzleOverviewQuery },
    GetDevicesUseCase,
    { provide: DEVICES_QUERY, useClass: DrizzleDevicesQuery },
    GetAcquisitionUseCase,
    { provide: ACQUISITION_QUERY, useClass: DrizzleAcquisitionQuery },
    GetFeaturesUseCase,
    { provide: FEATURES_QUERY, useClass: DrizzleFeaturesQuery },
    GetPropertyBreakdownUseCase,
    { provide: PROPERTY_BREAKDOWN_QUERY, useClass: DrizzlePropertyBreakdownQuery },
    GetRequestsUseCase,
    { provide: REQUESTS_QUERY, useClass: DrizzleRequestsQuery },
    GetFunnelUseCase,
    GetFunnelSubjectsUseCase,
    { provide: FUNNEL_QUERY, useClass: DrizzleFunnelQuery },
    GetTimelineUseCase,
    { provide: TIMELINE_QUERY, useClass: DrizzleTimelineQuery },
    GetTimeOfDayUseCase,
    { provide: TIME_OF_DAY_QUERY, useClass: DrizzleTimeOfDayQuery },
    GetVisitsUseCase,
    { provide: VISITS_QUERY, useClass: DrizzleVisitsQuery },
    GetProjectSettingsUseCase,
    { provide: PROJECT_KEY_REPOSITORY, useClass: DrizzleProjectKeyRepository },
    { provide: PROJECT_ACTIVITY_QUERY, useClass: DrizzleProjectActivityQuery },
    SessionGuard,
    ProjectAccessGuard,
  ],
})
export class QueriesModule {}

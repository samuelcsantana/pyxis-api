import { Module } from '@nestjs/common';
import { ACQUISITION_QUERY } from '../../../domain/queries/acquisition';
import { DEVICES_QUERY } from '../../../domain/queries/devices';
import { FEATURES_QUERY } from '../../../domain/queries/features';
import { FUNNEL_QUERY } from '../../../domain/queries/funnel';
import { PROPERTY_BREAKDOWN_QUERY } from '../../../domain/queries/property-breakdown';
import { REQUESTS_QUERY } from '../../../domain/queries/requests';
import { TIMELINE_QUERY } from '../../../domain/queries/timeline';
import { OVERVIEW_QUERY } from '../../../domain/queries/overview';
import { VISITS_QUERY } from '../../../domain/queries/visits';
import { GetAcquisitionUseCase } from '../../../usecases/queries/get-acquisition.usecase';
import { GetDevicesUseCase } from '../../../usecases/queries/get-devices.usecase';
import { GetFeaturesUseCase } from '../../../usecases/queries/get-features.usecase';
import { GetFunnelUseCase } from '../../../usecases/queries/get-funnel.usecase';
import { GetPropertyBreakdownUseCase } from '../../../usecases/queries/get-property-breakdown.usecase';
import { GetRequestsUseCase } from '../../../usecases/queries/get-requests.usecase';
import { GetTimelineUseCase } from '../../../usecases/queries/get-timeline.usecase';
import { GetOverviewUseCase } from '../../../usecases/queries/get-overview.usecase';
import { GetVisitsUseCase } from '../../../usecases/queries/get-visits.usecase';
import { DrizzleAcquisitionQuery } from '../../queries/drizzle-acquisition.query';
import { DrizzleDevicesQuery } from '../../queries/drizzle-devices.query';
import { DrizzleFeaturesQuery } from '../../queries/drizzle-features.query';
import { DrizzleFunnelQuery } from '../../queries/drizzle-funnel.query';
import { DrizzlePropertyBreakdownQuery } from '../../queries/drizzle-property-breakdown.query';
import { DrizzleRequestsQuery } from '../../queries/drizzle-requests.query';
import { DrizzleTimelineQuery } from '../../queries/drizzle-timeline.query';
import { DrizzleOverviewQuery } from '../../queries/drizzle-overview.query';
import { DrizzleVisitsQuery } from '../../queries/drizzle-visits.query';
import { AuthModule } from '../auth/auth.module';
import { SessionGuard } from '../auth/auth.guards';
import { ProjectAccessGuard } from './project-access.guard';
import { PropertyBreakdownController } from './property-breakdown.controller';
import { QueriesController } from './queries.controller';
import { VisitsController } from './visits.controller';

@Module({
  imports: [AuthModule],
  controllers: [QueriesController, PropertyBreakdownController, VisitsController],
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
    { provide: FUNNEL_QUERY, useClass: DrizzleFunnelQuery },
    GetTimelineUseCase,
    { provide: TIMELINE_QUERY, useClass: DrizzleTimelineQuery },
    GetVisitsUseCase,
    { provide: VISITS_QUERY, useClass: DrizzleVisitsQuery },
    SessionGuard,
    ProjectAccessGuard,
  ],
})
export class QueriesModule {}

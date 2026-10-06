import { Module } from '@nestjs/common';
import { ACQUISITION_QUERY } from '../../../domain/queries/acquisition';
import { DEVICES_QUERY } from '../../../domain/queries/devices';
import { FEATURES_QUERY } from '../../../domain/queries/features';
import { FUNNEL_QUERY } from '../../../domain/queries/funnel';
import { REQUESTS_QUERY } from '../../../domain/queries/requests';
import { OVERVIEW_QUERY } from '../../../domain/queries/overview';
import { GetAcquisitionUseCase } from '../../../usecases/queries/get-acquisition.usecase';
import { GetDevicesUseCase } from '../../../usecases/queries/get-devices.usecase';
import { GetFeaturesUseCase } from '../../../usecases/queries/get-features.usecase';
import { GetFunnelUseCase } from '../../../usecases/queries/get-funnel.usecase';
import { GetRequestsUseCase } from '../../../usecases/queries/get-requests.usecase';
import { GetOverviewUseCase } from '../../../usecases/queries/get-overview.usecase';
import { DrizzleAcquisitionQuery } from '../../queries/drizzle-acquisition.query';
import { DrizzleDevicesQuery } from '../../queries/drizzle-devices.query';
import { DrizzleFeaturesQuery } from '../../queries/drizzle-features.query';
import { DrizzleFunnelQuery } from '../../queries/drizzle-funnel.query';
import { DrizzleRequestsQuery } from '../../queries/drizzle-requests.query';
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
    GetDevicesUseCase,
    { provide: DEVICES_QUERY, useClass: DrizzleDevicesQuery },
    GetAcquisitionUseCase,
    { provide: ACQUISITION_QUERY, useClass: DrizzleAcquisitionQuery },
    GetFeaturesUseCase,
    { provide: FEATURES_QUERY, useClass: DrizzleFeaturesQuery },
    GetRequestsUseCase,
    { provide: REQUESTS_QUERY, useClass: DrizzleRequestsQuery },
    GetFunnelUseCase,
    { provide: FUNNEL_QUERY, useClass: DrizzleFunnelQuery },
    SessionGuard,
    ProjectAccessGuard,
  ],
})
export class QueriesModule {}

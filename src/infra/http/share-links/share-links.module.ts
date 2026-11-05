import { Module } from '@nestjs/common';
import { ACCOUNT_REPOSITORY } from '../../../domain/repositories/account.repository';
import { PROJECT_SETTINGS_REPOSITORY } from '../../../domain/repositories/project-settings.repository';
import { SHARE_LINK_REPOSITORY } from '../../../domain/repositories/share-link.repository';
import { RANDOM_SOURCE } from '../../../domain/services/random-source';
import { CreateShareLinkUseCase } from '../../../usecases/share-links/create-share-link.usecase';
import { ListShareLinksUseCase } from '../../../usecases/share-links/list-share-links.usecase';
import { OpenShareLinkUseCase } from '../../../usecases/share-links/open-share-link.usecase';
import { RevokeShareLinkUseCase } from '../../../usecases/share-links/revoke-share-link.usecase';
import { CryptoRandomSource } from '../../random/crypto-random-source';
import { DrizzleAccountRepository } from '../../repositories/drizzle-account.repository';
import { DrizzleProjectSettingsRepository } from '../../repositories/drizzle-project-settings.repository';
import { DrizzleShareLinkRepository } from '../../repositories/drizzle-share-link.repository';
import { DashboardOriginGuard, SessionGuard } from '../auth/auth.guards';
import { AuthModule } from '../auth/auth.module';
import { GoalsModule } from '../goals/goals.module';
import { QueriesModule } from '../queries/queries.module';
import { ClientAddressThrottlerGuard } from '../rate-limit/client-address-throttler.guard';
import { ShareLinkGuard } from './share-link.guard';
import { ShareLinksController } from './share-links.controller';
import { SharedReportsController } from './shared-reports.controller';

@Module({
  imports: [AuthModule, QueriesModule, GoalsModule],
  controllers: [ShareLinksController, SharedReportsController],
  providers: [
    CreateShareLinkUseCase,
    ListShareLinksUseCase,
    RevokeShareLinkUseCase,
    OpenShareLinkUseCase,
    { provide: SHARE_LINK_REPOSITORY, useClass: DrizzleShareLinkRepository },
    { provide: PROJECT_SETTINGS_REPOSITORY, useClass: DrizzleProjectSettingsRepository },
    { provide: ACCOUNT_REPOSITORY, useClass: DrizzleAccountRepository },
    { provide: RANDOM_SOURCE, useClass: CryptoRandomSource },
    DashboardOriginGuard,
    SessionGuard,
    ClientAddressThrottlerGuard,
    ShareLinkGuard,
  ],
})
export class ShareLinksModule {}

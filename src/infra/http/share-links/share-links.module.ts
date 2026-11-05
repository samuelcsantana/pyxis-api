import { Module } from '@nestjs/common';
import { PASSWORD_HASHER } from '../../../domain/services/password-hasher';
import { type RandomSource } from '../../../domain/services/random-source';
import { SetShareLinkPasswordUseCase } from '../../../usecases/share-links/set-share-link-password.usecase';
import { UnlockShareLinkUseCase } from '../../../usecases/share-links/unlock-share-link.usecase';
import { DrizzleShareUnlockRepository } from '../../repositories/drizzle-share-unlock.repository';
import { ScryptPasswordHasher } from '../../security/scrypt-password-hasher';
import { ACCOUNT_REPOSITORY } from '../../../domain/repositories/account.repository';
import { PROJECT_SETTINGS_REPOSITORY } from '../../../domain/repositories/project-settings.repository';
import {
  SHARE_LINK_REPOSITORY,
  SHARE_UNLOCK_REPOSITORY,
} from '../../../domain/repositories/share-link.repository';
import { RANDOM_SOURCE } from '../../../domain/services/random-source';
import { CreateShareLinkUseCase } from '../../../usecases/share-links/create-share-link.usecase';
import { ListShareLinksUseCase } from '../../../usecases/share-links/list-share-links.usecase';
import { OpenShareLinkUseCase } from '../../../usecases/share-links/open-share-link.usecase';
import { RevokeShareLinkUseCase } from '../../../usecases/share-links/revoke-share-link.usecase';
import { CryptoRandomSource } from '../../random/crypto-random-source';
import { DrizzleAccountRepository } from '../../repositories/drizzle-account.repository';
import { DrizzleProjectSettingsRepository } from '../../repositories/drizzle-project-settings.repository';
import { DrizzleShareLinkRepository } from '../../repositories/drizzle-share-link.repository';
import { AnnotationsModule } from '../annotations/annotations.module';
import { DashboardOriginGuard, SessionGuard } from '../auth/auth.guards';
import { AuthModule } from '../auth/auth.module';
import { GoalsModule } from '../goals/goals.module';
import { QueriesModule } from '../queries/queries.module';
import { ClientAddressThrottlerGuard } from '../rate-limit/client-address-throttler.guard';
import { ShareLinkGuard } from './share-link.guard';
import { ShareLinksController } from './share-links.controller';
import { ShareUnlockController } from './share-unlock.controller';
import { SharedReportsController } from './shared-reports.controller';

@Module({
  imports: [AuthModule, QueriesModule, GoalsModule, AnnotationsModule],
  controllers: [ShareLinksController, SharedReportsController, ShareUnlockController],
  providers: [
    CreateShareLinkUseCase,
    ListShareLinksUseCase,
    RevokeShareLinkUseCase,
    OpenShareLinkUseCase,
    SetShareLinkPasswordUseCase,
    UnlockShareLinkUseCase,
    { provide: SHARE_UNLOCK_REPOSITORY, useClass: DrizzleShareUnlockRepository },
    {
      provide: PASSWORD_HASHER,
      useFactory: (random: RandomSource) => new ScryptPasswordHasher(random),
      inject: [RANDOM_SOURCE],
    },
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

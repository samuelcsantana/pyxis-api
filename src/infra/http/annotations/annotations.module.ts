import { Module } from '@nestjs/common';
import { ACCOUNT_REPOSITORY } from '../../../domain/repositories/account.repository';
import { ANNOTATION_REPOSITORY } from '../../../domain/repositories/annotation.repository';
import { PROJECT_KEY_REPOSITORY } from '../../../domain/repositories/project-key.repository';
import { PROJECT_SETTINGS_REPOSITORY } from '../../../domain/repositories/project-settings.repository';
import { CreateAnnotationByKeyUseCase } from '../../../usecases/annotations/create-annotation-by-key.usecase';
import { CreateAnnotationUseCase } from '../../../usecases/annotations/create-annotation.usecase';
import { DeleteAnnotationUseCase } from '../../../usecases/annotations/delete-annotation.usecase';
import { ListAnnotationsUseCase } from '../../../usecases/annotations/list-annotations.usecase';
import { UpdateAnnotationUseCase } from '../../../usecases/annotations/update-annotation.usecase';
import { AuthenticateSecretKeyUseCase } from '../../../usecases/subjects/authenticate-secret-key.usecase';
import { DrizzleAccountRepository } from '../../repositories/drizzle-account.repository';
import { DrizzleAnnotationRepository } from '../../repositories/drizzle-annotation.repository';
import { DrizzleProjectKeyRepository } from '../../repositories/drizzle-project-key.repository';
import { DrizzleProjectSettingsRepository } from '../../repositories/drizzle-project-settings.repository';
import { AccessTokenThrottlerGuard } from '../auth/access-token-throttler.guard';
import { DashboardOriginGuard, SessionGuard } from '../auth/auth.guards';
import { AuthModule } from '../auth/auth.module';
import { ReadAccessGuard } from '../auth/read-access.guard';
import { ProjectAccessGuard } from '../queries/project-access.guard';
import { ClientAddressThrottlerGuard } from '../rate-limit/client-address-throttler.guard';
import { SecretKeyThrottlerGuard } from '../subjects/secret-key-throttler.guard';
import { SecretKeyGuard } from '../subjects/secret-key.guard';
import { AnnotationSettingsController } from './annotation-settings.controller';
import { AnnotationsByKeyController } from './annotations-by-key.controller';
import { AnnotationsController } from './annotations.controller';

@Module({
  imports: [AuthModule],
  controllers: [AnnotationsController, AnnotationSettingsController, AnnotationsByKeyController],
  providers: [
    ListAnnotationsUseCase,
    CreateAnnotationUseCase,
    UpdateAnnotationUseCase,
    DeleteAnnotationUseCase,
    CreateAnnotationByKeyUseCase,
    AuthenticateSecretKeyUseCase,
    { provide: PROJECT_KEY_REPOSITORY, useClass: DrizzleProjectKeyRepository },
    { provide: ANNOTATION_REPOSITORY, useClass: DrizzleAnnotationRepository },
    { provide: PROJECT_SETTINGS_REPOSITORY, useClass: DrizzleProjectSettingsRepository },
    { provide: ACCOUNT_REPOSITORY, useClass: DrizzleAccountRepository },
    DashboardOriginGuard,
    SessionGuard,
    ReadAccessGuard,
    AccessTokenThrottlerGuard,
    ProjectAccessGuard,
    ClientAddressThrottlerGuard,
    SecretKeyGuard,
    SecretKeyThrottlerGuard,
  ],
  exports: [ListAnnotationsUseCase],
})
export class AnnotationsModule {}

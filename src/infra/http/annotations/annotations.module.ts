import { Module } from '@nestjs/common';
import { ACCOUNT_REPOSITORY } from '../../../domain/repositories/account.repository';
import { ANNOTATION_REPOSITORY } from '../../../domain/repositories/annotation.repository';
import { PROJECT_SETTINGS_REPOSITORY } from '../../../domain/repositories/project-settings.repository';
import { CreateAnnotationUseCase } from '../../../usecases/annotations/create-annotation.usecase';
import { DeleteAnnotationUseCase } from '../../../usecases/annotations/delete-annotation.usecase';
import { ListAnnotationsUseCase } from '../../../usecases/annotations/list-annotations.usecase';
import { UpdateAnnotationUseCase } from '../../../usecases/annotations/update-annotation.usecase';
import { DrizzleAccountRepository } from '../../repositories/drizzle-account.repository';
import { DrizzleAnnotationRepository } from '../../repositories/drizzle-annotation.repository';
import { DrizzleProjectSettingsRepository } from '../../repositories/drizzle-project-settings.repository';
import { AccessTokenThrottlerGuard } from '../auth/access-token-throttler.guard';
import { DashboardOriginGuard, SessionGuard } from '../auth/auth.guards';
import { AuthModule } from '../auth/auth.module';
import { ReadAccessGuard } from '../auth/read-access.guard';
import { ProjectAccessGuard } from '../queries/project-access.guard';
import { AnnotationSettingsController } from './annotation-settings.controller';
import { AnnotationsController } from './annotations.controller';

@Module({
  imports: [AuthModule],
  controllers: [AnnotationsController, AnnotationSettingsController],
  providers: [
    ListAnnotationsUseCase,
    CreateAnnotationUseCase,
    UpdateAnnotationUseCase,
    DeleteAnnotationUseCase,
    { provide: ANNOTATION_REPOSITORY, useClass: DrizzleAnnotationRepository },
    { provide: PROJECT_SETTINGS_REPOSITORY, useClass: DrizzleProjectSettingsRepository },
    { provide: ACCOUNT_REPOSITORY, useClass: DrizzleAccountRepository },
    DashboardOriginGuard,
    SessionGuard,
    ReadAccessGuard,
    AccessTokenThrottlerGuard,
    ProjectAccessGuard,
  ],
  exports: [ListAnnotationsUseCase],
})
export class AnnotationsModule {}

import { Module } from '@nestjs/common';
import { ACCOUNT_REPOSITORY } from '../../../domain/repositories/account.repository';
import { PROJECT_KEY_REPOSITORY } from '../../../domain/repositories/project-key.repository';
import { PROJECT_SETTINGS_REPOSITORY } from '../../../domain/repositories/project-settings.repository';
import { RANDOM_SOURCE } from '../../../domain/services/random-source';
import { CreateOwnedProjectKeyUseCase } from '../../../usecases/projects/create-owned-project-key.usecase';
import { CreateOwnedProjectUseCase } from '../../../usecases/projects/create-owned-project.usecase';
import { CreateProjectKeyUseCase } from '../../../usecases/projects/create-project-key.usecase';
import { CreateProjectUseCase } from '../../../usecases/projects/create-project.usecase';
import { DeleteOwnedProjectUseCase } from '../../../usecases/projects/delete-owned-project.usecase';
import { DeleteProjectUseCase } from '../../../usecases/projects/delete-project.usecase';
import { RevokeOwnedProjectKeyUseCase } from '../../../usecases/projects/revoke-owned-project-key.usecase';
import { UpdateOwnedProjectUseCase } from '../../../usecases/projects/update-owned-project.usecase';
import { UpdateProjectUseCase } from '../../../usecases/projects/update-project.usecase';
import { CryptoRandomSource } from '../../random/crypto-random-source';
import { DrizzleAccountRepository } from '../../repositories/drizzle-account.repository';
import { DrizzleProjectKeyRepository } from '../../repositories/drizzle-project-key.repository';
import { DrizzleProjectSettingsRepository } from '../../repositories/drizzle-project-settings.repository';
import { AuthModule } from '../auth/auth.module';
import { DashboardOriginGuard, SessionGuard } from '../auth/auth.guards';
import { ProjectsController } from './projects.controller';

@Module({
  imports: [AuthModule],
  controllers: [ProjectsController],
  providers: [
    CreateProjectUseCase,
    UpdateProjectUseCase,
    DeleteProjectUseCase,
    CreateProjectKeyUseCase,
    CreateOwnedProjectUseCase,
    UpdateOwnedProjectUseCase,
    DeleteOwnedProjectUseCase,
    CreateOwnedProjectKeyUseCase,
    RevokeOwnedProjectKeyUseCase,
    DashboardOriginGuard,
    SessionGuard,
    { provide: RANDOM_SOURCE, useClass: CryptoRandomSource },
    { provide: ACCOUNT_REPOSITORY, useClass: DrizzleAccountRepository },
    { provide: PROJECT_SETTINGS_REPOSITORY, useClass: DrizzleProjectSettingsRepository },
    { provide: PROJECT_KEY_REPOSITORY, useClass: DrizzleProjectKeyRepository },
  ],
})
export class ProjectsModule {}

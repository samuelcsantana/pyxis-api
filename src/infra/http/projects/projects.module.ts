import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../../config/env.schema';
import { ACCOUNT_REPOSITORY } from '../../../domain/repositories/account.repository';
import { PROJECT_KEY_REPOSITORY } from '../../../domain/repositories/project-key.repository';
import { PROJECT_EXPORT_REPOSITORY } from '../../../domain/repositories/project-export.repository';
import { PROJECT_PEOPLE_REPOSITORY } from '../../../domain/repositories/project-people.repository';
import { PROJECT_SETTINGS_REPOSITORY } from '../../../domain/repositories/project-settings.repository';
import { EXPORT_DISPATCHER, EXPORT_STORAGE } from '../../../domain/services/export-storage';
import { RANDOM_SOURCE } from '../../../domain/services/random-source';
import { GetProjectExportUseCase } from '../../../usecases/exports/get-project-export.usecase';
import { RequestProjectExportUseCase } from '../../../usecases/exports/request-project-export.usecase';
import { AddProjectPersonUseCase } from '../../../usecases/people/add-project-person.usecase';
import { ListProjectPeopleUseCase } from '../../../usecases/people/list-project-people.usecase';
import { RemoveProjectPersonUseCase } from '../../../usecases/people/remove-project-person.usecase';
import { CreateOwnedProjectKeyUseCase } from '../../../usecases/projects/create-owned-project-key.usecase';
import { CreateOwnedProjectUseCase } from '../../../usecases/projects/create-owned-project.usecase';
import { CreateProjectKeyUseCase } from '../../../usecases/projects/create-project-key.usecase';
import { CreateProjectUseCase } from '../../../usecases/projects/create-project.usecase';
import { DeleteOwnedProjectUseCase } from '../../../usecases/projects/delete-owned-project.usecase';
import { DeleteProjectUseCase } from '../../../usecases/projects/delete-project.usecase';
import { RevokeOwnedProjectKeyUseCase } from '../../../usecases/projects/revoke-owned-project-key.usecase';
import { UpdateOwnedProjectUseCase } from '../../../usecases/projects/update-owned-project.usecase';
import { UpdateProjectUseCase } from '../../../usecases/projects/update-project.usecase';
import { createExportDispatcher } from '../../exports/lambda-export-dispatcher';
import { createExportStorage } from '../../exports/s3-export-storage';
import { CryptoRandomSource } from '../../random/crypto-random-source';
import { DrizzleProjectExportRepository } from '../../repositories/drizzle-project-export.repository';
import { DrizzleAccountRepository } from '../../repositories/drizzle-account.repository';
import { DrizzleProjectKeyRepository } from '../../repositories/drizzle-project-key.repository';
import { DrizzleProjectPeopleRepository } from '../../repositories/drizzle-project-people.repository';
import { DrizzleProjectSettingsRepository } from '../../repositories/drizzle-project-settings.repository';
import { AuthModule } from '../auth/auth.module';
import { DashboardOriginGuard, SessionGuard } from '../auth/auth.guards';
import { ProjectAccessGuard } from '../queries/project-access.guard';
import { ExportsController } from './exports.controller';
import { PeopleController } from './people.controller';
import { ProjectsController } from './projects.controller';

@Module({
  imports: [AuthModule],
  controllers: [ProjectsController, PeopleController, ExportsController],
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
    ListProjectPeopleUseCase,
    AddProjectPersonUseCase,
    RemoveProjectPersonUseCase,
    RequestProjectExportUseCase,
    GetProjectExportUseCase,
    DashboardOriginGuard,
    SessionGuard,
    ProjectAccessGuard,
    { provide: RANDOM_SOURCE, useClass: CryptoRandomSource },
    { provide: ACCOUNT_REPOSITORY, useClass: DrizzleAccountRepository },
    { provide: PROJECT_SETTINGS_REPOSITORY, useClass: DrizzleProjectSettingsRepository },
    { provide: PROJECT_KEY_REPOSITORY, useClass: DrizzleProjectKeyRepository },
    { provide: PROJECT_PEOPLE_REPOSITORY, useClass: DrizzleProjectPeopleRepository },
    { provide: PROJECT_EXPORT_REPOSITORY, useClass: DrizzleProjectExportRepository },
    {
      provide: EXPORT_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) =>
        createExportStorage(config.get('EXPORT_BUCKET', { infer: true })),
    },
    {
      provide: EXPORT_DISPATCHER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) =>
        createExportDispatcher(config.get('JOBS_FUNCTION_NAME', { infer: true })),
    },
  ],
})
export class ProjectsModule {}

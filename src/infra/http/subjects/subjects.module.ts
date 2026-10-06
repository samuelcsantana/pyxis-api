import { Module } from '@nestjs/common';
import { PROJECT_KEY_REPOSITORY } from '../../../domain/repositories/project-key.repository';
import { SUBJECT_EVENTS_REPOSITORY } from '../../../domain/subjects/subject-events';
import { AuthenticateSecretKeyUseCase } from '../../../usecases/subjects/authenticate-secret-key.usecase';
import { EraseSubjectUseCase } from '../../../usecases/subjects/erase-subject.usecase';
import { ExportSubjectEventsUseCase } from '../../../usecases/subjects/export-subject-events.usecase';
import { DrizzleProjectKeyRepository } from '../../repositories/drizzle-project-key.repository';
import { DrizzleSubjectEventsRepository } from '../../repositories/drizzle-subject-events.repository';
import { SecretKeyThrottlerGuard } from './secret-key-throttler.guard';
import { SecretKeyGuard } from './secret-key.guard';
import { SubjectsController } from './subjects.controller';

@Module({
  controllers: [SubjectsController],
  providers: [
    AuthenticateSecretKeyUseCase,
    EraseSubjectUseCase,
    ExportSubjectEventsUseCase,
    SecretKeyGuard,
    SecretKeyThrottlerGuard,
    { provide: PROJECT_KEY_REPOSITORY, useClass: DrizzleProjectKeyRepository },
    { provide: SUBJECT_EVENTS_REPOSITORY, useClass: DrizzleSubjectEventsRepository },
  ],
})
export class SubjectsModule {}

import { Module } from '@nestjs/common';
import { EMAIL_PREFERENCES_REPOSITORY } from '../../../domain/repositories/email-preferences.repository';
import { GetEmailPreferencesUseCase } from '../../../usecases/preferences/get-email-preferences.usecase';
import { SetEmailPreferencesUseCase } from '../../../usecases/preferences/set-email-preferences.usecase';
import { DrizzleEmailPreferencesRepository } from '../../repositories/drizzle-email-preferences.repository';
import { AuthModule } from '../auth/auth.module';
import { SessionGuard } from '../auth/auth.guards';
import { ProjectAccessGuard } from '../queries/project-access.guard';
import { EmailPreferencesController } from './email-preferences.controller';

@Module({
  imports: [AuthModule],
  controllers: [EmailPreferencesController],
  providers: [
    GetEmailPreferencesUseCase,
    SetEmailPreferencesUseCase,
    { provide: EMAIL_PREFERENCES_REPOSITORY, useClass: DrizzleEmailPreferencesRepository },
    SessionGuard,
    ProjectAccessGuard,
  ],
})
export class PreferencesModule {}

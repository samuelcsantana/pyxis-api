import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import type { EmailPreferences } from '../../domain/entities/email-preferences.entity';
import type { Project } from '../../domain/entities/project.entity';
import { ProjectNotFoundError } from '../../domain/errors/project.errors';
import {
  EMAIL_PREFERENCES_REPOSITORY,
  type EmailPreferencesRepository,
} from '../../domain/repositories/email-preferences.repository';

@Injectable()
export class SetEmailPreferencesUseCase {
  private readonly logger = new Logger(SetEmailPreferencesUseCase.name);

  constructor(
    @Inject(EMAIL_PREFERENCES_REPOSITORY) private readonly preferences: EmailPreferencesRepository,
  ) {}

  async execute(
    admin: AdminUser,
    project: Project,
    wanted: EmailPreferences,
  ): Promise<EmailPreferences> {
    const saved = await this.preferences.save(admin.id, project.id, wanted);
    if (saved === null) {
      throw new ProjectNotFoundError();
    }
    this.logger.log({
      message: 'email_preferences.updated',
      adminUserId: admin.id,
      projectId: project.id,
      weeklyDigest: saved.weeklyDigest,
    });
    return saved;
  }
}

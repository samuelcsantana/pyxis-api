import { Inject, Injectable } from '@nestjs/common';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import type { EmailPreferences } from '../../domain/entities/email-preferences.entity';
import type { Project } from '../../domain/entities/project.entity';
import { ProjectNotFoundError } from '../../domain/errors/project.errors';
import {
  EMAIL_PREFERENCES_REPOSITORY,
  type EmailPreferencesRepository,
} from '../../domain/repositories/email-preferences.repository';

@Injectable()
export class GetEmailPreferencesUseCase {
  constructor(
    @Inject(EMAIL_PREFERENCES_REPOSITORY) private readonly preferences: EmailPreferencesRepository,
  ) {}

  async execute(admin: AdminUser, project: Project): Promise<EmailPreferences> {
    const stored = await this.preferences.preferencesOf(admin.id, project.id);
    if (stored === null) {
      throw new ProjectNotFoundError();
    }
    return stored;
  }
}

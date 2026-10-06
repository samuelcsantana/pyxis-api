import { Inject, Injectable } from '@nestjs/common';
import { normalizeEmail } from '../../domain/auth/email';
import { ProjectNotFoundError } from '../../domain/errors/project.errors';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../domain/repositories/admin-user.repository';
import {
  PROJECT_SETTINGS_REPOSITORY,
  type ProjectSettingsRepository,
} from '../../domain/repositories/project-settings.repository';

export interface GrantAdminAccessCommand {
  readonly email: string;
  readonly projectId: string;
}

export interface AdminAccessGrant {
  readonly adminUserId: string;
  readonly email: string;
  readonly projectId: string;
}

@Injectable()
export class GrantAdminAccessUseCase {
  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository,
  ) {}

  async execute(command: GrantAdminAccessCommand): Promise<AdminAccessGrant> {
    if ((await this.projects.findById(command.projectId)) === null) {
      throw new ProjectNotFoundError();
    }
    const admin = await this.admins.grantAccess(normalizeEmail(command.email), command.projectId);
    return { adminUserId: admin.id, email: admin.email, projectId: command.projectId };
  }
}

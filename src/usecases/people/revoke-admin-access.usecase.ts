import { Inject, Injectable } from '@nestjs/common';
import { normalizeEmail } from '../../domain/auth/email';
import { OwnerStaysError, PersonNotFoundError } from '../../domain/errors/people.errors';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../domain/repositories/admin-user.repository';
import {
  PROJECT_PEOPLE_REPOSITORY,
  type ProjectPeopleRepository,
} from '../../domain/repositories/project-people.repository';
import {
  PROJECT_SETTINGS_REPOSITORY,
  type ProjectSettingsRepository,
} from '../../domain/repositories/project-settings.repository';
import { ownerOfProject } from '../projects/owned-project';

export interface RevokeAdminAccessCommand {
  readonly email: string;
  readonly projectId: string;
}

export interface RevokedAdminAccess {
  readonly adminUserId: string;
  readonly email: string;
  readonly projectId: string;
}

@Injectable()
export class RevokeAdminAccessUseCase {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository,
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(PROJECT_PEOPLE_REPOSITORY) private readonly people: ProjectPeopleRepository,
  ) {}

  async execute(command: RevokeAdminAccessCommand): Promise<RevokedAdminAccess> {
    const admin = await this.admins.findByEmail(normalizeEmail(command.email));
    if (admin === null) {
      throw new PersonNotFoundError();
    }
    if (admin.id === (await ownerOfProject(this.projects, this.accounts, command.projectId))) {
      throw new OwnerStaysError();
    }
    if (!(await this.people.remove(command.projectId, admin.id))) {
      throw new PersonNotFoundError();
    }
    return { adminUserId: admin.id, email: admin.email, projectId: command.projectId };
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import type { Project } from '../../domain/entities/project.entity';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../domain/repositories/admin-user.repository';

export interface AdminDescription {
  readonly email: string;
  readonly projects: readonly Project[];
}

@Injectable()
export class DescribeAdminUseCase {
  constructor(@Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository) {}

  async execute(admin: AdminUser): Promise<AdminDescription> {
    return { email: admin.email, projects: await this.admins.projectsOf(admin.id) };
  }
}

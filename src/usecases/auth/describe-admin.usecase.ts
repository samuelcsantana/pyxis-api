import { Inject, Injectable } from '@nestjs/common';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import type { Project } from '../../domain/entities/project.entity';
import {
  NO_ACTIVITY,
  PROJECT_ACTIVITY_QUERY,
  type ProjectActivity,
  type ProjectActivityQuery,
} from '../../domain/queries/project-activity';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../domain/repositories/admin-user.repository';

export interface DescribedProject extends Project, ProjectActivity {}

export interface AdminDescription {
  readonly email: string;
  readonly projects: readonly DescribedProject[];
}

@Injectable()
export class DescribeAdminUseCase {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository,
    @Inject(PROJECT_ACTIVITY_QUERY) private readonly activity: ProjectActivityQuery,
  ) {}

  async execute(admin: AdminUser): Promise<AdminDescription> {
    const projects = await this.admins.projectsOf(admin.id);
    const activity = await this.activity.activityOf(projects.map((project) => project.id));
    return {
      email: admin.email,
      projects: projects.map((project) => ({
        ...project,
        ...(activity.get(project.id) ?? NO_ACTIVITY),
      })),
    };
  }
}

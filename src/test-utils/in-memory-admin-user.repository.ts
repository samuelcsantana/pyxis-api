import type { AdminUser } from '../domain/entities/admin-user.entity';
import type { Project } from '../domain/entities/project.entity';
import type { AdminUserRepository } from '../domain/repositories/admin-user.repository';

const CREATED_AT = new Date('2026-10-01T00:00:00.000Z');

export class InMemoryAdminUserRepository implements AdminUserRepository {
  private readonly admins: AdminUser[] = [];
  private readonly projects = new Map<string, Project>();
  private readonly access: { readonly adminUserId: string; readonly projectId: string }[] = [];

  addProject(project: Project): void {
    this.projects.set(project.id, project);
  }

  findByEmail(email: string): Promise<AdminUser | null> {
    return Promise.resolve(this.admins.find((admin) => admin.email === email) ?? null);
  }

  findById(adminUserId: string): Promise<AdminUser | null> {
    return Promise.resolve(this.admins.find((admin) => admin.id === adminUserId) ?? null);
  }

  projectsOf(adminUserId: string): Promise<readonly Project[]> {
    return Promise.resolve(
      this.access
        .filter((entry) => entry.adminUserId === adminUserId)
        .flatMap((entry) => {
          const project = this.projects.get(entry.projectId);
          return project === undefined ? [] : [project];
        }),
    );
  }

  async accessibleProject(adminUserId: string, projectId: string): Promise<Project | null> {
    const projects = await this.projectsOf(adminUserId);
    return projects.find((project) => project.id === projectId) ?? null;
  }

  async grantAccess(email: string, projectId: string): Promise<AdminUser> {
    const admin = (await this.findByEmail(email)) ?? this.createAdmin(email);
    if (
      !this.access.some((entry) => entry.adminUserId === admin.id && entry.projectId === projectId)
    ) {
      this.access.push({ adminUserId: admin.id, projectId });
    }
    return admin;
  }

  private createAdmin(email: string): AdminUser {
    const admin: AdminUser = {
      id: `00000000-0000-4000-a000-${String(this.admins.length + 1).padStart(12, '0')}`,
      email,
      createdAt: CREATED_AT,
    };
    this.admins.push(admin);
    return admin;
  }
}

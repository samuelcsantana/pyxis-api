import type { AdminUser } from '../entities/admin-user.entity';
import type { Project } from '../entities/project.entity';

export interface AdminUserRepository {
  findByEmail(email: string): Promise<AdminUser | null>;
  findById(adminUserId: string): Promise<AdminUser | null>;
  projectsOf(adminUserId: string): Promise<readonly Project[]>;
  grantAccess(email: string, projectId: string): Promise<AdminUser>;
}

export const ADMIN_USER_REPOSITORY = Symbol('AdminUserRepository');

import type { EmailLanguage } from '../auth/email-language';
import type { AdminUser } from '../entities/admin-user.entity';
import type { Project } from '../entities/project.entity';

export interface AdminUserRepository {
  findByEmail(email: string): Promise<AdminUser | null>;
  findById(adminUserId: string): Promise<AdminUser | null>;
  projectsOf(adminUserId: string): Promise<readonly Project[]>;
  accessibleProject(adminUserId: string, projectId: string): Promise<Project | null>;
  grantAccess(email: string, projectId: string): Promise<AdminUser>;
  setEmailLanguage(adminUserId: string, language: EmailLanguage): Promise<void>;
}

export const ADMIN_USER_REPOSITORY = Symbol('AdminUserRepository');

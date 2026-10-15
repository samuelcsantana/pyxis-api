import type { AdminUser } from '../entities/admin-user.entity';

export interface AdminSuspensionRepository {
  suspend(adminUserId: string, at: Date): Promise<AdminUser | null>;
  resume(adminUserId: string): Promise<AdminUser | null>;
}

export const ADMIN_SUSPENSION_REPOSITORY = Symbol('AdminSuspensionRepository');

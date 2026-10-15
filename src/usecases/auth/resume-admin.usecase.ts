import { Inject, Injectable } from '@nestjs/common';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import { normalizeEmail } from '../../domain/auth/email';
import { AdminNotFoundError } from '../../domain/errors/auth.errors';
import {
  ADMIN_SUSPENSION_REPOSITORY,
  type AdminSuspensionRepository,
} from '../../domain/repositories/admin-suspension.repository';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../domain/repositories/admin-user.repository';
import type { AdminByEmailCommand } from './suspend-admin.usecase';

@Injectable()
export class ResumeAdminUseCase {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository,
    @Inject(ADMIN_SUSPENSION_REPOSITORY) private readonly suspensions: AdminSuspensionRepository,
  ) {}

  async execute(command: AdminByEmailCommand): Promise<AdminUser> {
    const admin = await this.admins.findByEmail(normalizeEmail(command.email));
    const resumed = admin === null ? null : await this.suspensions.resume(admin.id);
    if (resumed === null) {
      throw new AdminNotFoundError();
    }
    return resumed;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import type { AdminSuspensionRepository } from '../../domain/repositories/admin-suspension.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { adminUsers } from '../database/schema/admins';
import { toAdminUser } from './drizzle-admin-user.repository';

@Injectable()
export class DrizzleAdminSuspensionRepository implements AdminSuspensionRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async suspend(adminUserId: string, at: Date): Promise<AdminUser | null> {
    const [row] = await this.db
      .update(adminUsers)
      .set({ suspendedAt: at })
      .where(eq(adminUsers.id, adminUserId))
      .returning();
    return row === undefined ? null : toAdminUser(row);
  }

  async resume(adminUserId: string): Promise<AdminUser | null> {
    const [row] = await this.db
      .update(adminUsers)
      .set({ suspendedAt: null })
      .where(eq(adminUsers.id, adminUserId))
      .returning();
    return row === undefined ? null : toAdminUser(row);
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { and, eq, exists, isNotNull, isNull, lte, not, or } from 'drizzle-orm';
import type { ProjectlessPeopleRepository } from '../../domain/repositories/projectless-people.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { accounts } from '../database/schema/accounts';
import { adminProjectAccess, adminUsers } from '../database/schema/admins';

@Injectable()
export class DrizzleProjectlessPeopleRepository implements ProjectlessPeopleRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async clearReturned(): Promise<number> {
    const cleared = await this.db
      .update(adminUsers)
      .set({ projectlessSince: null })
      .where(and(isNotNull(adminUsers.projectlessSince), or(this.hasAccess(), this.ownsAccount())))
      .returning({ id: adminUsers.id });
    return cleared.length;
  }

  async markProjectless(at: Date): Promise<number> {
    const marked = await this.db
      .update(adminUsers)
      .set({ projectlessSince: at })
      .where(and(isNull(adminUsers.projectlessSince), this.projectless()))
      .returning({ id: adminUsers.id });
    return marked.length;
  }

  async deleteProjectlessSince(before: Date): Promise<number> {
    const deleted = await this.db
      .delete(adminUsers)
      .where(and(lte(adminUsers.projectlessSince, before), this.projectless()))
      .returning({ id: adminUsers.id });
    return deleted.length;
  }

  private projectless() {
    return and(not(this.hasAccess()), not(this.ownsAccount()));
  }

  private hasAccess() {
    return exists(
      this.db
        .select({ projectId: adminProjectAccess.projectId })
        .from(adminProjectAccess)
        .where(eq(adminProjectAccess.adminUserId, adminUsers.id)),
    );
  }

  private ownsAccount() {
    return exists(
      this.db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.ownerAdminId, adminUsers.id)),
    );
  }
}

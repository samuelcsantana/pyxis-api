import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import type { Project } from '../../domain/entities/project.entity';
import type { AdminUserRepository } from '../../domain/repositories/admin-user.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { insertedRow } from '../database/inserted-row';
import { adminProjectAccess, adminUsers } from '../database/schema/admins';
import { projects } from '../database/schema/projects';
import { toProject } from './drizzle-project.repository';

type AdminUserRow = typeof adminUsers.$inferSelect;

function toAdminUser(row: AdminUserRow): AdminUser {
  return { id: row.id, email: row.email, createdAt: row.createdAt };
}

@Injectable()
export class DrizzleAdminUserRepository implements AdminUserRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async findByEmail(email: string): Promise<AdminUser | null> {
    const [row] = await this.db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, email))
      .limit(1);
    return row === undefined ? null : toAdminUser(row);
  }

  async findById(adminUserId: string): Promise<AdminUser | null> {
    const [row] = await this.db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, adminUserId))
      .limit(1);
    return row === undefined ? null : toAdminUser(row);
  }

  async projectsOf(adminUserId: string): Promise<readonly Project[]> {
    const rows = await this.db
      .select({ project: projects })
      .from(adminProjectAccess)
      .innerJoin(projects, eq(adminProjectAccess.projectId, projects.id))
      .where(eq(adminProjectAccess.adminUserId, adminUserId))
      .orderBy(asc(projects.name));
    return rows.map((row) => toProject(row.project));
  }

  async accessibleProject(adminUserId: string, projectId: string): Promise<Project | null> {
    const [row] = await this.db
      .select({ project: projects })
      .from(adminProjectAccess)
      .innerJoin(projects, eq(adminProjectAccess.projectId, projects.id))
      .where(
        and(
          eq(adminProjectAccess.adminUserId, adminUserId),
          eq(adminProjectAccess.projectId, projectId),
        ),
      )
      .limit(1);
    return row === undefined ? null : toProject(row.project);
  }

  grantAccess(email: string, projectId: string): Promise<AdminUser> {
    return this.db.transaction(async (transaction) => {
      await transaction.insert(adminUsers).values({ email }).onConflictDoNothing();
      const admin = insertedRow(
        await transaction.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1),
      );
      await transaction
        .insert(adminProjectAccess)
        .values({ adminUserId: admin.id, projectId })
        .onConflictDoNothing();
      return toAdminUser(admin);
    });
  }
}

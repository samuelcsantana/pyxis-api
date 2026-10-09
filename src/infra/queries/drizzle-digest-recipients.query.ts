import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type { DigestRecipient, DigestRecipientsQuery } from '../../domain/digest/digest-recipients';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { adminProjectAccess, adminUsers } from '../database/schema/admins';
import { projects } from '../database/schema/projects';
import { toProject } from '../repositories/drizzle-project.repository';

@Injectable()
export class DrizzleDigestRecipientsQuery implements DigestRecipientsQuery {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async recipients(): Promise<readonly DigestRecipient[]> {
    const rows = await this.db
      .select({ admin: adminUsers, project: projects })
      .from(adminProjectAccess)
      .innerJoin(adminUsers, eq(adminProjectAccess.adminUserId, adminUsers.id))
      .innerJoin(projects, eq(adminProjectAccess.projectId, projects.id))
      .where(eq(adminProjectAccess.weeklyDigest, true))
      .orderBy(asc(projects.name), asc(projects.id), asc(adminUsers.email));
    return rows.map(({ admin, project }) => ({
      adminUserId: admin.id,
      email: admin.email,
      emailLanguage: admin.emailLanguage,
      project: toProject(project),
    }));
  }
}

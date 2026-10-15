import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import type {
  ProjectRestrictions,
  ProjectRestrictionsQuery,
} from '../../domain/queries/project-restrictions';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { accounts } from '../database/schema/accounts';
import { projects } from '../database/schema/projects';

@Injectable()
export class DrizzleProjectRestrictionsQuery implements ProjectRestrictionsQuery {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async restrictionsOf(
    adminUserId: string,
    projectIds: readonly string[],
  ): Promise<ReadonlyMap<string, ProjectRestrictions>> {
    if (projectIds.length === 0) {
      return new Map();
    }
    const rows = await this.db
      .select({
        projectId: projects.id,
        ingestionSuspendedAt: projects.ingestionSuspendedAt,
        ingestionSuspensionReason: projects.ingestionSuspensionReason,
        ownerAdminId: accounts.ownerAdminId,
      })
      .from(projects)
      .leftJoin(accounts, eq(accounts.id, projects.accountId))
      .where(inArray(projects.id, [...projectIds]));
    return new Map(
      rows.map((row) => [
        row.projectId,
        {
          ingestionSuspendedAt: row.ingestionSuspendedAt,
          ingestionSuspensionReason:
            row.ownerAdminId === adminUserId ? row.ingestionSuspensionReason : null,
        },
      ]),
    );
  }
}

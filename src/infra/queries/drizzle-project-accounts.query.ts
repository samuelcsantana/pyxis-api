import { Inject, Injectable } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import type { ProjectAccountsQuery } from '../../domain/queries/project-accounts';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { projects } from '../database/schema/projects';

@Injectable()
export class DrizzleProjectAccountsQuery implements ProjectAccountsQuery {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async accountsOf(projectIds: readonly string[]): Promise<ReadonlyMap<string, string | null>> {
    if (projectIds.length === 0) {
      return new Map();
    }
    const rows = await this.db
      .select({ projectId: projects.id, accountId: projects.accountId })
      .from(projects)
      .where(inArray(projects.id, [...projectIds]));
    return new Map(rows.map((row) => [row.projectId, row.accountId]));
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { ProjectUsage, ProjectUsageQuery } from '../../domain/queries/project-usage';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { events } from '../database/schema/events';
import { projects } from '../database/schema/projects';

@Injectable()
export class DrizzleProjectUsageQuery implements ProjectUsageQuery {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async usageBetween(from: Date, to: Date): Promise<readonly ProjectUsage[]> {
    const rows = await this.db.execute<{
      projectId: string;
      name: string;
      events: number;
      visits: number;
    }>(sql`
      SELECT ${projects.id} AS "projectId",
        ${projects.name} AS "name",
        count(${events.id})::int AS "events",
        count(DISTINCT ${events.sessionId})::int AS "visits"
      FROM ${projects}
      LEFT JOIN ${events}
        ON ${events.projectId} = ${projects.id}
        AND ${events.receivedAt} >= ${from.toISOString()}::timestamptz
        AND ${events.receivedAt} < ${to.toISOString()}::timestamptz
      GROUP BY ${projects.id}, ${projects.name}
      ORDER BY "events" DESC, ${projects.name}`);
    return rows.map((row) => ({
      projectId: row.projectId,
      name: row.name,
      events: row.events,
      visits: row.visits,
    }));
  }
}

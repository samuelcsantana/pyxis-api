import { Inject, Injectable } from '@nestjs/common';
import { inArray, type SQL, sql } from 'drizzle-orm';
import type { ProjectActivity, ProjectActivityQuery } from '../../domain/queries/project-activity';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { events } from '../database/schema/events';
import { projects } from '../database/schema/projects';

function eventOfProject(edge: 'min' | 'max'): SQL {
  const at = edge === 'min' ? sql`min(${events.occurredAt})` : sql`max(${events.occurredAt})`;
  return sql`(SELECT to_char(${at} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    FROM ${events} WHERE ${events.projectId} = ${projects.id})`;
}

function dateOrNull(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

@Injectable()
export class DrizzleProjectActivityQuery implements ProjectActivityQuery {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async activityOf(projectIds: readonly string[]): Promise<ReadonlyMap<string, ProjectActivity>> {
    const rows = await this.db.execute<{
      projectId: string;
      firstEventAt: string | null;
      lastEventAt: string | null;
    }>(sql`
      SELECT ${projects.id} AS "projectId",
        ${eventOfProject('min')} AS "firstEventAt",
        ${eventOfProject('max')} AS "lastEventAt"
      FROM ${projects}
      WHERE ${inArray(projects.id, [...projectIds])}`);
    return new Map(
      rows.map((row) => [
        row.projectId,
        { firstEventAt: dateOrNull(row.firstEventAt), lastEventAt: dateOrNull(row.lastEventAt) },
      ]),
    );
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';
import { IDENTIFY } from '../../domain/events/reserved-event-names';
import type { SubjectEvent, SubjectEventsRepository } from '../../domain/subjects/subject-events';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { events } from '../database/schema/events';

function subjectRows(projectId: string, userId: string): SQL {
  return sql`${events.projectId} = ${projectId} AND (
    ${events.userId} = ${userId}
    OR ${events.sessionId} IN (
      SELECT linked.session_id FROM ${events} AS linked
      WHERE linked.project_id = ${projectId} AND linked.user_id = ${userId}
        AND linked.name = ${IDENTIFY}
    )
  )`;
}

type SubjectEventRow = Omit<SubjectEvent, 'occurredAt'> & { readonly occurredAt: string };

@Injectable()
export class DrizzleSubjectEventsRepository implements SubjectEventsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async erase(projectId: string, userId: string): Promise<number> {
    const deleted = await this.db.execute<{ id: string }>(sql`
      DELETE FROM ${events}
      WHERE ${subjectRows(projectId, userId)}
      RETURNING ${events.id}`);
    return deleted.length;
  }

  async hasEvent(projectId: string, eventId: string): Promise<boolean> {
    const found = await this.db.execute<{ id: string }>(sql`
      SELECT ${events.id} FROM ${events}
      WHERE ${events.projectId} = ${projectId} AND ${events.id} = ${eventId}
      LIMIT 1`);
    return found.length > 0;
  }

  async page(
    projectId: string,
    userId: string,
    after: string | null,
    limit: number,
  ): Promise<readonly SubjectEvent[]> {
    const afterCursor =
      after === null
        ? sql``
        : sql` AND (${events.occurredAt}, ${events.id}) > (
            SELECT cursor.occurred_at, cursor.id FROM ${events} AS cursor
            WHERE cursor.project_id = ${projectId} AND cursor.id = ${after}
          )`;
    const rows = await this.db.execute<{
      -readonly [Key in keyof SubjectEventRow]: SubjectEventRow[Key];
    }>(sql`
      SELECT ${events.id} AS "id", ${events.name} AS "name",
        to_char(${events.occurredAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "occurredAt",
        ${events.sessionId} AS "sessionId", ${events.path} AS "path",
        ${events.referrerHost} AS "referrerHost", ${events.utmSource} AS "utmSource",
        ${events.utmMedium} AS "utmMedium", ${events.utmCampaign} AS "utmCampaign",
        ${events.fromAdClick} AS "fromAdClick", ${events.deviceType} AS "deviceType",
        ${events.browser} AS "browser", ${events.os} AS "os", ${events.country} AS "country",
        ${events.properties} AS "properties"
      FROM ${events}
      WHERE ${subjectRows(projectId, userId)}${afterCursor}
      ORDER BY ${events.occurredAt}, ${events.id}
      LIMIT ${limit}`);
    return rows.map((row) => ({ ...row, occurredAt: new Date(row.occurredAt) }));
  }
}

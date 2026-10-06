import { Inject, Injectable } from '@nestjs/common';
import { inArray, type SQL, sql } from 'drizzle-orm';
import type { Channel, PropertyMap } from '../../domain/entities/tracked-event.entity';
import type {
  TimelineEvent,
  TimelineQuery,
  TimelineSubject,
  VisitSummary,
} from '../../domain/queries/timeline';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { events } from '../database/schema/events';

function isoUtc(column: SQL): SQL {
  return sql`to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
}

function subjectSessions(projectId: string, subject: TimelineSubject): SQL {
  const match =
    subject.userId === undefined
      ? sql`${events.sessionId} = ${subject.sessionId}`
      : sql`${events.userId} = ${subject.userId}`;
  return sql`
    SELECT DISTINCT ${events.sessionId} AS "sessionId"
    FROM ${events}
    WHERE ${events.projectId} = ${projectId} AND ${match}`;
}

interface VisitRow {
  readonly sessionId: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly deviceType: string;
  readonly browser: string;
  readonly os: string;
  readonly country: string | null;
  readonly channel: Channel | null;
}

interface EventRow {
  readonly id: string;
  readonly sessionId: string;
  readonly occurredAt: string;
  readonly name: string;
  readonly path: string;
  readonly properties: PropertyMap;
}

@Injectable()
export class DrizzleTimelineQuery implements TimelineQuery {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async visits(
    projectId: string,
    subject: TimelineSubject,
    before: Date | null,
    limit: number,
  ): Promise<readonly VisitSummary[]> {
    const beforeCursor =
      before === null
        ? sql``
        : sql`WHERE visits."startedAtValue" < ${before.toISOString()}::timestamptz`;
    const rows = await this.db.execute<{ -readonly [Key in keyof VisitRow]: VisitRow[Key] }>(sql`
      WITH subject_sessions AS (${subjectSessions(projectId, subject)}),
      session_events AS (
        SELECT ${events.sessionId} AS "sessionId", ${events.occurredAt} AS "occurredAt",
          ${events.deviceType} AS "deviceType", ${events.browser} AS "browser",
          ${events.os} AS "os", ${events.country} AS "country", ${events.channel} AS "channel"
        FROM ${events}
        WHERE ${events.projectId} = ${projectId}
          AND ${events.sessionId} IN (SELECT "sessionId" FROM subject_sessions)
      ),
      visits AS (
        SELECT DISTINCT ON ("sessionId")
          "sessionId", "deviceType", "browser", "os", "country",
          min("occurredAt") OVER (PARTITION BY "sessionId") AS "startedAtValue",
          max("occurredAt") OVER (PARTITION BY "sessionId") AS "endedAtValue",
          (SELECT entry."channel" FROM session_events AS entry
            WHERE entry."sessionId" = session_events."sessionId" AND entry."channel" IS NOT NULL
            ORDER BY entry."occurredAt" LIMIT 1) AS "channel"
        FROM session_events
        ORDER BY "sessionId", "occurredAt"
      )
      SELECT "sessionId", "deviceType", "browser", "os", "country", "channel",
        ${isoUtc(sql`"startedAtValue"`)} AS "startedAt",
        ${isoUtc(sql`"endedAtValue"`)} AS "endedAt"
      FROM visits
      ${beforeCursor}
      ORDER BY "startedAtValue" DESC
      LIMIT ${limit}`);
    return rows.map((row) => ({
      ...row,
      startedAt: new Date(row.startedAt),
      endedAt: new Date(row.endedAt),
    }));
  }

  async events(
    projectId: string,
    sessionIds: readonly string[],
  ): Promise<readonly TimelineEvent[]> {
    const rows = await this.db.execute<{ -readonly [Key in keyof EventRow]: EventRow[Key] }>(sql`
      SELECT ${events.id} AS "id", ${events.sessionId} AS "sessionId",
        ${isoUtc(sql`${events.occurredAt}`)} AS "occurredAt",
        ${events.name} AS "name", ${events.path} AS "path", ${events.properties} AS "properties"
      FROM ${events}
      WHERE ${events.projectId} = ${projectId} AND ${inArray(events.sessionId, [...sessionIds])}
      ORDER BY ${events.occurredAt}, ${events.id}`);
    return rows.map((row) => ({ ...row, occurredAt: new Date(row.occurredAt) }));
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';
import type { Channel } from '../../domain/entities/tracked-event.entity';
import { API_REQUEST } from '../../domain/events/reserved-event-names';
import { likePattern } from '../../domain/queries/funnel';
import type { QueryScope } from '../../domain/queries/query-scope';
import {
  MAX_VISIT_HIGHLIGHTS,
  type VisitCursor,
  type VisitFilters,
  type VisitIdentity,
  type VisitListItem,
  type VisitsQuery,
} from '../../domain/queries/visits';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { events } from '../database/schema/events';
import { inScope, isNamedEvent, isPageView } from './definitions';

const isFailedRequest = sql`${events.name} = ${API_REQUEST}
  AND ((${events.properties}->>'status')::int = 0 OR (${events.properties}->>'status')::int >= 400)`;

const inVisitOrder = sql`ORDER BY ${events.occurredAt}, ${events.id}`;

function firstOf(column: SQL, filter: SQL = sql`true`): SQL {
  return sql`(array_agg(${column} ${inVisitOrder}) FILTER (WHERE ${filter}))[1]`;
}

function isoUtc(column: SQL): SQL {
  return sql`to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
}

function allOf(conditions: readonly SQL[]): SQL {
  return sql.join([sql`true`, ...conditions], sql` AND `);
}

function activityConditions(filters: VisitFilters): readonly SQL[] {
  const pages = filters.paths.map(
    (path) => sql`bool_or(${isPageView} AND ${events.path} LIKE ${likePattern(path)} ESCAPE '\\')`,
  );
  if (filters.event === null) {
    return pages;
  }
  const { name, property } = filters.event;
  const carries =
    property === null
      ? sql``
      : sql` AND ${events.properties}->>${property.key} = ${property.value}`;
  return [...pages, sql`bool_or(${events.name} = ${name}${carries})`];
}

function identityCondition(identity: VisitIdentity): SQL {
  return identity === 'identified' ? sql`"userId" IS NOT NULL` : sql`"userId" IS NULL`;
}

function visitConditions(filters: VisitFilters, after: VisitCursor | null): readonly SQL[] {
  return [
    ...(filters.channel === null ? [] : [sql`"channel" = ${filters.channel}`]),
    ...(filters.deviceType === null ? [] : [sql`"deviceType" = ${filters.deviceType}`]),
    ...(filters.identity === null ? [] : [identityCondition(filters.identity)]),
    ...(after === null
      ? []
      : [
          sql`("startedAtValue", "sessionId") < (${after.startedAt.toISOString()}::timestamptz, ${after.sessionId}::uuid)`,
        ]),
  ];
}

interface VisitRow {
  readonly sessionId: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly entryPath: string | null;
  readonly pageViews: number;
  readonly highlights: string[];
  readonly failedRequests: number;
  readonly deviceType: string;
  readonly browser: string;
  readonly os: string;
  readonly country: string | null;
  readonly channel: Channel | null;
  readonly userId: string | null;
}

@Injectable()
export class DrizzleVisitsQuery implements VisitsQuery {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async list(
    scope: QueryScope,
    filters: VisitFilters,
    after: VisitCursor | null,
    limit: number,
  ): Promise<readonly VisitListItem[]> {
    const rows = await this.db.execute<{ -readonly [Key in keyof VisitRow]: VisitRow[Key] }>(sql`
      WITH visits AS (
        SELECT ${events.sessionId} AS "sessionId",
          min(${events.occurredAt}) AS "startedAtValue",
          max(${events.occurredAt}) AS "endedAtValue",
          ${firstOf(sql`${events.path}`, isPageView)} AS "entryPath",
          count(*) FILTER (WHERE ${isPageView})::int AS "pageViews",
          count(*) FILTER (WHERE ${isFailedRequest})::int AS "failedRequests",
          ${firstOf(sql`${events.deviceType}`)} AS "deviceType",
          ${firstOf(sql`${events.browser}`)} AS "browser",
          ${firstOf(sql`${events.os}`)} AS "os",
          ${firstOf(sql`${events.country}`)} AS "country",
          ${firstOf(sql`${events.channel}`, sql`${events.channel} IS NOT NULL`)} AS "channel",
          ${firstOf(sql`${events.userId}`, sql`${events.userId} IS NOT NULL`)} AS "userId"
        FROM ${events}
        WHERE ${inScope(scope)}
        GROUP BY ${events.sessionId}
        HAVING ${allOf(activityConditions(filters))}
      ),
      named AS (
        SELECT ${events.sessionId} AS "sessionId", ${events.name} AS "name",
          min(${events.occurredAt}) AS "firstAt"
        FROM ${events}
        WHERE ${inScope(scope)} AND ${isNamedEvent}
        GROUP BY 1, 2
      ),
      page AS (
        SELECT * FROM visits
        WHERE ${allOf(visitConditions(filters, after))}
        ORDER BY "startedAtValue" DESC, "sessionId" DESC
        LIMIT ${limit}
      )
      SELECT "sessionId", "entryPath", "pageViews", "failedRequests", "deviceType", "browser",
        "os", "country", "channel", "userId",
        ${isoUtc(sql`"startedAtValue"`)} AS "startedAt",
        ${isoUtc(sql`"endedAtValue"`)} AS "endedAt",
        ARRAY(
          SELECT named."name" FROM named
          WHERE named."sessionId" = page."sessionId"
          ORDER BY named."firstAt", named."name"
          LIMIT ${MAX_VISIT_HIGHLIGHTS}
        ) AS "highlights"
      FROM page
      ORDER BY "startedAtValue" DESC, "sessionId" DESC`);
    return rows.map((row) => ({
      ...row,
      startedAt: new Date(row.startedAt),
      endedAt: new Date(row.endedAt),
    }));
  }
}

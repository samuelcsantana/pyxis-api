import { Inject, Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';
import type { Channel } from '../../domain/entities/tracked-event.entity';
import { API_REQUEST } from '../../domain/events/reserved-event-names';
import type { QueryScope } from '../../domain/queries/query-scope';
import {
  MAX_VISIT_HIGHLIGHTS,
  type VisitCursor,
  type VisitFilters,
  type VisitListItem,
  type VisitMatches,
  type VisitsQuery,
} from '../../domain/queries/visits';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { events } from '../database/schema/events';
import {
  entrySource,
  hasFailed,
  isEntryPageView,
  isFailedRequest,
  isNamedEvent,
  isPageView,
} from './definitions';
import { inScope, reportFilterConditions } from './report-filters';

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

function routeConditions(filters: VisitFilters): readonly SQL[] {
  if (filters.route === null) {
    return [];
  }
  const failing = filters.failed ? sql` AND ${hasFailed}` : sql``;
  return [
    sql`bool_or(${events.name} = ${API_REQUEST}
      AND ${events.properties}->>'method' = ${filters.route.method}
      AND ${events.properties}->>'route' = ${filters.route.route}${failing})`,
  ];
}

function matchConditions(filters: VisitFilters): readonly SQL[] {
  const failedAnywhere = filters.failed && filters.route === null;
  return [
    ...reportFilterConditions({ ...filters, failed: failedAnywhere }),
    ...routeConditions(filters),
  ];
}

function cursorConditions(after: VisitCursor | null): readonly SQL[] {
  return after === null
    ? []
    : [
        sql`("startedAtValue", "sessionId") < (${after.startedAt.toISOString()}::timestamptz, ${after.sessionId}::uuid)`,
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
  readonly region: string | null;
  readonly regionName: string | null;
  readonly channel: Channel | null;
  readonly source: string | null;
  readonly campaign: string | null;
  readonly userId: string | null;
}

type MatchRow = { -readonly [Key in keyof VisitRow]: VisitRow[Key] | null } & { total: number };

function isVisitRow(row: MatchRow): row is VisitRow & { total: number } {
  return row.sessionId !== null;
}

function listItem(row: VisitRow): VisitListItem {
  return {
    sessionId: row.sessionId,
    startedAt: new Date(row.startedAt),
    endedAt: new Date(row.endedAt),
    entryPath: row.entryPath,
    pageViews: row.pageViews,
    highlights: row.highlights,
    failedRequests: row.failedRequests,
    deviceType: row.deviceType,
    browser: row.browser,
    os: row.os,
    country: row.country,
    region: row.region,
    regionName: row.regionName,
    channel: row.channel,
    source: row.source,
    campaign: row.campaign,
    userId: row.userId,
  };
}

@Injectable()
export class DrizzleVisitsQuery implements VisitsQuery {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async list(
    scope: QueryScope,
    filters: VisitFilters,
    after: VisitCursor | null,
    limit: number,
  ): Promise<VisitMatches> {
    const rows = await this.db.execute<MatchRow>(sql`
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
          ${firstOf(sql`${events.region}`)} AS "region",
          ${firstOf(sql`${events.regionName}`)} AS "regionName",
          ${firstOf(sql`${events.channel}`, sql`${events.channel} IS NOT NULL`)} AS "channel",
          ${firstOf(entrySource, isEntryPageView)} AS "source",
          ${firstOf(sql`${events.utmCampaign}`, isEntryPageView)} AS "campaign",
          ${firstOf(sql`${events.userId}`, sql`${events.userId} IS NOT NULL`)} AS "userId"
        FROM ${events}
        WHERE ${inScope(scope)}
        GROUP BY ${events.sessionId}
        HAVING ${allOf(matchConditions(filters))}
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
        WHERE ${allOf(cursorConditions(after))}
        ORDER BY "startedAtValue" DESC, "sessionId" DESC
        LIMIT ${limit}
      ),
      totals AS (
        SELECT count(*)::int AS "total" FROM visits
      )
      SELECT totals."total", page."sessionId", page."entryPath", page."pageViews",
        page."failedRequests", page."deviceType", page."browser", page."os", page."country",
        page."region", page."regionName", page."channel", page."source", page."campaign", page."userId",
        ${isoUtc(sql`page."startedAtValue"`)} AS "startedAt",
        ${isoUtc(sql`page."endedAtValue"`)} AS "endedAt",
        to_jsonb(ARRAY(
          SELECT named."name" FROM named
          WHERE named."sessionId" = page."sessionId"
          ORDER BY named."firstAt", named."name"
          LIMIT ${MAX_VISIT_HIGHLIGHTS}
        )) AS "highlights"
      FROM totals
      LEFT JOIN page ON true
      ORDER BY page."startedAtValue" DESC, page."sessionId" DESC`);
    return {
      items: rows.filter(isVisitRow).map(listItem),
      total: Math.max(0, ...rows.map((row) => row.total)),
    };
  }
}

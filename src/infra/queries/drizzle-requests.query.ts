import { Inject, Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';
import type {
  RequestKind,
  RequestsQuery,
  RequestsScope,
  RouteFailure,
  RouteScreenCount,
  RouteStatusCount,
  RouteTotal,
} from '../../domain/queries/requests';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { events } from '../database/schema/events';
import { hasFailed, inScope, isFailedRead, isWrite } from './definitions';

const method = sql`${events.properties}->>'method'`;
const route = sql`${events.properties}->>'route'`;
const status = sql`(${events.properties}->>'status')::int`;
const durationMs = sql`(${events.properties}->>'duration_ms')::int`;
const utcIsoTimestamp = sql`to_char(${events.occurredAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

const COUNTED_REQUESTS: Readonly<Record<RequestKind, SQL>> = {
  writes: isWrite,
  reads: isFailedRead,
};

function requestsInScope(scope: RequestsScope): SQL {
  const onScreen = scope.screen === null ? sql`` : sql` AND ${events.path} = ${scope.screen}`;
  return sql`${inScope(scope)} AND ${COUNTED_REQUESTS[scope.kind]}${onScreen}`;
}

@Injectable()
export class DrizzleRequestsQuery implements RequestsQuery {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async routes(scope: RequestsScope, limit: number): Promise<readonly RouteTotal[]> {
    const rows = await this.db.execute<{ -readonly [Key in keyof RouteTotal]: RouteTotal[Key] }>(
      sql`
        SELECT ${method} AS "method", ${route} AS "route",
          count(*)::int AS "total",
          count(*) FILTER (WHERE ${hasFailed})::int AS "failed",
          round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ${durationMs}))::int AS "medianDurationMs"
        FROM ${events}
        WHERE ${requestsInScope(scope)}
        GROUP BY 1, 2
        ORDER BY "failed" DESC, "total" DESC, "method", "route"
        LIMIT ${limit}`,
    );
    return [...rows];
  }

  async statuses(scope: RequestsScope): Promise<readonly RouteStatusCount[]> {
    const rows = await this.db.execute<{
      -readonly [Key in keyof RouteStatusCount]: RouteStatusCount[Key];
    }>(sql`
      SELECT ${method} AS "method", ${route} AS "route", ${status} AS "status",
        count(*)::int AS "count"
      FROM ${events}
      WHERE ${requestsInScope(scope)}
      GROUP BY 1, 2, 3
      ORDER BY 1, 2, 3`);
    return [...rows];
  }

  async screens(scope: RequestsScope): Promise<readonly RouteScreenCount[]> {
    const rows = await this.db.execute<{
      -readonly [Key in keyof RouteScreenCount]: RouteScreenCount[Key];
    }>(sql`
      SELECT ${method} AS "method", ${route} AS "route", ${events.path} AS "path",
        count(*) FILTER (WHERE ${hasFailed})::int AS "failed"
      FROM ${events}
      WHERE ${requestsInScope(scope)}
      GROUP BY 1, 2, 3
      ORDER BY "failed" DESC, "path"`);
    return [...rows];
  }

  async recentFailures(scope: RequestsScope, perRoute: number): Promise<readonly RouteFailure[]> {
    const rows = await this.db.execute<
      { -readonly [Key in Exclude<keyof RouteFailure, 'occurredAt'>]: RouteFailure[Key] } & {
        occurredAt: string;
      }
    >(sql`
      SELECT "method", "route", "occurredAt", "status", "errorCode", "sessionId"
      FROM (
        SELECT ${method} AS "method", ${route} AS "route",
          ${utcIsoTimestamp} AS "occurredAt", ${status} AS "status",
          ${events.properties}->>'error_code' AS "errorCode",
          ${events.sessionId} AS "sessionId",
          row_number() OVER (PARTITION BY ${method}, ${route} ORDER BY ${events.occurredAt} DESC)
            AS "rank"
        FROM ${events}
        WHERE ${requestsInScope(scope)} AND ${hasFailed}
      ) AS ranked
      WHERE "rank" <= ${perRoute}
      ORDER BY "method", "route", "occurredAt" DESC`);
    return rows.map((row) => ({ ...row, occurredAt: new Date(row.occurredAt) }));
  }
}

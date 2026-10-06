import { type SQL, sql } from 'drizzle-orm';
import { API_REQUEST, IDENTIFY, PAGE_VIEW } from '../../domain/events/reserved-event-names';
import type { QueryScope } from '../../domain/queries/query-scope';
import { events } from '../database/schema/events';

export function inScope(scope: QueryScope): SQL {
  return sql`${events.projectId} = ${scope.projectId}
    AND ${events.occurredAt} >= (${scope.range.from}::date)::timestamp AT TIME ZONE ${scope.timeZone}
    AND ${events.occurredAt} < (${scope.range.to}::date + 1)::timestamp AT TIME ZONE ${scope.timeZone}`;
}

export function localDay(scope: QueryScope): SQL {
  return sql`(date_trunc('day', ${events.occurredAt} AT TIME ZONE ${scope.timeZone}))::date::text`;
}

export const isPageView = sql`${events.name} = ${PAGE_VIEW}`;

export const isNamedEvent = sql`${events.name} NOT IN (${PAGE_VIEW}, ${IDENTIFY}, ${API_REQUEST})`;

export const isWrite = sql`${events.name} = ${API_REQUEST} AND ${events.properties}->>'method' <> 'GET'`;

export const isFailedWrite = sql`${isWrite}
  AND ((${events.properties}->>'status')::int = 0 OR (${events.properties}->>'status')::int >= 400)`;

export function isConversion(scope: QueryScope): SQL {
  return sql`${events.name} = ${scope.conversionEvent}`;
}

export const visits = sql`count(DISTINCT ${events.sessionId}) FILTER (WHERE ${isPageView})::int`;

export function periodTotalsColumns(scope: QueryScope): SQL {
  return sql`${visits} AS "visits",
    count(DISTINCT ${events.userId})::int AS "identifiedUsers",
    count(*) FILTER (WHERE ${isConversion(scope)})::int AS "conversions",
    count(*) FILTER (WHERE ${isWrite})::int AS "writes",
    count(*) FILTER (WHERE ${isFailedWrite})::int AS "failedWrites"`;
}

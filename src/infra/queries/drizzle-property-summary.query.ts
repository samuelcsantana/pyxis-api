import { Inject, Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';
import type {
  GroupedSummary,
  NumericSummary,
  PropertySummaryCounts,
  PropertySummaryQuery,
  PropertySummaryRequest,
} from '../../domain/queries/property-summary';
import type { QueryScope } from '../../domain/queries/query-scope';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { events } from '../database/schema/events';
import { isNamedEvent } from './definitions';
import { inScope } from './report-filters';

interface SummaryRow {
  readonly events: number;
  readonly p25: number | null;
  readonly median: number | null;
  readonly p75: number | null;
}

interface GroupRow extends SummaryRow {
  readonly value: string;
  readonly groupedEvents: number;
}

const QUARTILES = sql.raw('percentile_cont(ARRAY[0.25, 0.5, 0.75])');
const EACH_QUARTILE = sql.raw(
  '"quartiles"[1] AS "p25", "quartiles"[2] AS "median", "quartiles"[3] AS "p75"',
);

function numericValueOf(key: string): SQL {
  return sql`(${events.properties} ->> ${key}::text)::float8`;
}

function withNumber(scope: QueryScope, request: PropertySummaryRequest): SQL {
  return sql`${inScope(scope)} AND ${isNamedEvent} AND ${events.name} = ${request.name}
    AND jsonb_typeof(${events.properties} -> ${request.key}::text) = 'number'`;
}

function summaryOf(row: SummaryRow): NumericSummary {
  return { events: row.events, median: row.median, p25: row.p25, p75: row.p75 };
}

@Injectable()
export class DrizzlePropertySummaryQuery implements PropertySummaryQuery {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async summarize(
    scope: QueryScope,
    request: PropertySummaryRequest,
    groups: number,
  ): Promise<PropertySummaryCounts> {
    const [overall, grouped] = await Promise.all([
      this.overall(scope, request),
      request.by === null ? Promise.resolve([]) : this.grouped(scope, request, request.by, groups),
    ]);
    return {
      overall,
      groups: grouped.map((row): GroupedSummary => ({ value: row.value, ...summaryOf(row) })),
      groupedEvents: grouped[0]?.groupedEvents ?? 0,
    };
  }

  private async overall(
    scope: QueryScope,
    request: PropertySummaryRequest,
  ): Promise<NumericSummary> {
    const rows = await this.db.execute(sql`
      SELECT "events", ${EACH_QUARTILE}
      FROM (
        SELECT count(*)::int AS "events",
          ${QUARTILES} WITHIN GROUP (ORDER BY ${numericValueOf(request.key)}) AS "quartiles"
        FROM ${events}
        WHERE ${withNumber(scope, request)}
      ) AS "summary"`);
    const [row] = rows as unknown as readonly [SummaryRow];
    return summaryOf(row);
  }

  private async grouped(
    scope: QueryScope,
    request: PropertySummaryRequest,
    by: string,
    groups: number,
  ): Promise<readonly GroupRow[]> {
    const rows = await this.db.execute(sql`
      WITH valued AS (
        SELECT ${numericValueOf(request.key)} AS "number",
          ${events.properties} ->> ${by}::text AS "value"
        FROM ${events}
        WHERE ${withNumber(scope, request)} AND ${events.properties} ->> ${by}::text IS NOT NULL
      ), summarized AS (
        SELECT "value",
          count(*)::int AS "events",
          ${QUARTILES} WITHIN GROUP (ORDER BY "number") AS "quartiles",
          (sum(count(*)) OVER ())::int AS "groupedEvents",
          row_number() OVER (ORDER BY count(*) DESC, "value") AS "rank"
        FROM valued
        GROUP BY "value"
      )
      SELECT "value", "events", ${EACH_QUARTILE}, "groupedEvents"
      FROM summarized
      WHERE "rank" <= ${groups}`);
    return rows as unknown as readonly GroupRow[];
  }
}

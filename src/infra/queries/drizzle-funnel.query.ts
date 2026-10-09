import { Inject, Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';
import { PAGE_VIEW } from '../../domain/events/reserved-event-names';
import {
  type FunnelMode,
  type FunnelQuery,
  type FunnelReport,
  type FunnelSegment,
  type FunnelSegmentDimension,
  type FunnelStep,
  type FunnelSubject,
  type FunnelSubjectCursor,
  type FunnelSubjectsAsked,
  likePattern,
  UNKNOWN_SEGMENT,
} from '../../domain/queries/funnel';
import type { QueryScope } from '../../domain/queries/query-scope';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { events } from '../database/schema/events';
import { inScope } from './definitions';

function subjectEvents(scope: QueryScope, mode: FunnelMode): SQL {
  if (mode === 'visit') {
    return sql`
      SELECT ${events.sessionId}::text AS "subject", ${events.occurredAt} AS "at",
        ${events.name} AS "name", ${events.path} AS "path"
      FROM ${events}
      WHERE ${inScope(scope)}`;
  }
  return sql`
    SELECT linked."userId" AS "subject", ${events.occurredAt} AS "at",
      ${events.name} AS "name", ${events.path} AS "path"
    FROM ${events}
    JOIN (
      SELECT DISTINCT ON (${events.sessionId})
        ${events.sessionId} AS "sessionId", ${events.userId} AS "userId"
      FROM ${events}
      WHERE ${inScope(scope)} AND ${events.userId} IS NOT NULL
      ORDER BY ${events.sessionId}, ${events.occurredAt}
    ) AS linked ON linked."sessionId" = ${events.sessionId}
    WHERE ${inScope(scope)}`;
}

function matches(step: FunnelStep): SQL {
  return step.type === 'page'
    ? sql`subject_events."name" = ${PAGE_VIEW}
        AND subject_events."path" LIKE ${likePattern(step.path)} ESCAPE '\\'`
    : sql`subject_events."name" = ${step.name}`;
}

function stepName(index: number): SQL {
  return sql.raw(`step_${String(index)}`);
}

function stepTable(step: FunnelStep, index: number): SQL {
  if (index === 0) {
    return sql`${stepName(index)} AS (
      SELECT subject_events."subject", min(subject_events."at") AS "at"
      FROM subject_events
      WHERE ${matches(step)}
      GROUP BY subject_events."subject"
    )`;
  }
  const previous = stepName(index - 1);
  return sql`${stepName(index)} AS (
    SELECT subject_events."subject", min(subject_events."at") AS "at"
    FROM ${previous}
    JOIN subject_events ON subject_events."subject" = ${previous}."subject"
      AND subject_events."at" >= ${previous}."at"
    WHERE ${matches(step)}
    GROUP BY subject_events."subject"
  )`;
}

function column(prefix: string, index: number): string {
  return `${prefix}${String(index)}`;
}

function medianSecondsBetween(later: number, earlier: number, alias: string): SQL {
  const to = stepName(later);
  const from = stepName(earlier);
  return sql`(
    SELECT round(extract(epoch FROM
      percentile_cont(0.5) WITHIN GROUP (ORDER BY ${to}."at" - ${from}."at")))::int
    FROM ${to} JOIN ${from} USING ("subject")
  ) AS ${sql.raw(`"${alias}"`)}`;
}

type MeasureRow = Readonly<Record<string, number | null>>;

function isoUtc(column: SQL): SQL {
  return sql`to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
}

function chosenSubjects(asked: FunnelSubjectsAsked): SQL {
  const step = stepName(asked.stepIndex);
  if (asked.outcome === 'reached') {
    return sql`SELECT ${step}."subject", ${step}."at" FROM ${step}`;
  }
  const previous = stepName(asked.stepIndex - 1);
  return sql`
    SELECT ${previous}."subject", ${previous}."at" FROM ${previous}
    WHERE NOT EXISTS (SELECT 1 FROM ${step} WHERE ${step}."subject" = ${previous}."subject")`;
}

function subjectCursor(after: FunnelSubjectCursor | null): SQL {
  return after === null
    ? sql`true`
    : sql`(chosen."at", chosen."subject") < (${after.lastStepAt.toISOString()}::timestamptz, ${after.id})`;
}

function segmentOfVisit(by: FunnelSegmentDimension): SQL {
  return by === 'device'
    ? sql`min(${events.deviceType})`
    : sql`(array_agg(${events.channel} ORDER BY ${events.occurredAt})
        FILTER (WHERE ${events.channel} IS NOT NULL))[1]`;
}

interface SubjectRow {
  readonly id: string;
  readonly lastStepAt: string;
}

@Injectable()
export class DrizzleFunnelQuery implements FunnelQuery {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async measure(
    scope: QueryScope,
    mode: FunnelMode,
    steps: readonly FunnelStep[],
  ): Promise<FunnelReport> {
    const last = steps.length - 1;
    const tables = steps.map((step, index) => stepTable(step, index));
    const counts = steps.map(
      (_, index) =>
        sql`(SELECT count(*)::int FROM ${stepName(index)}) AS ${sql.raw(`"${column('count_', index)}"`)}`,
    );
    const times = steps
      .slice(1)
      .map((_, offset) => medianSecondsBetween(offset + 1, offset, column('seconds_', offset + 1)));
    const rows = await this.db.execute<Record<string, number | null>>(sql`
      WITH subject_events AS (${subjectEvents(scope, mode)}),
      ${sql.join(tables, sql`, `)}
      SELECT ${sql.join([...counts, ...times, medianSecondsBetween(last, 0, 'overall')], sql`, `)}`);
    const [row] = rows as unknown as readonly [MeasureRow];
    return {
      steps: steps.map((_, index) => ({
        count: Number(row[column('count_', index)]),
        medianSecondsFromPrevious: row[column('seconds_', index)] ?? null,
      })),
      medianSecondsOverall: row.overall ?? null,
    };
  }

  async subjects(
    scope: QueryScope,
    asked: FunnelSubjectsAsked,
    after: FunnelSubjectCursor | null,
    limit: number,
  ): Promise<readonly FunnelSubject[]> {
    const tables = asked.steps
      .slice(0, asked.stepIndex + 1)
      .map((step, index) => stepTable(step, index));
    const rows = await this.db.execute<{ -readonly [Key in keyof SubjectRow]: SubjectRow[Key] }>(
      sql`
        WITH subject_events AS (${subjectEvents(scope, asked.mode)}),
        ${sql.join(tables, sql`, `)},
        chosen AS (${chosenSubjects(asked)})
        SELECT chosen."subject" AS "id", ${isoUtc(sql`chosen."at"`)} AS "lastStepAt"
        FROM chosen
        WHERE ${subjectCursor(after)}
        ORDER BY chosen."at" DESC, chosen."subject" DESC
        LIMIT ${limit}`,
    );
    return rows.map((row) => ({ id: row.id, lastStepAt: new Date(row.lastStepAt) }));
  }

  async segments(
    scope: QueryScope,
    steps: readonly FunnelStep[],
    by: FunnelSegmentDimension,
  ): Promise<readonly FunnelSegment[]> {
    const tables = steps.map((step, index) => stepTable(step, index));
    const joins = steps
      .slice(1)
      .map((_, offset) => sql`LEFT JOIN ${stepName(offset + 1)} USING ("subject")`);
    const counts = steps.map((_, index) => sql`count(${stepName(index)}."subject")::int`);
    const rows = await this.db.execute<{ segment: string; counts: number[] }>(sql`
      WITH subject_events AS (${subjectEvents(scope, 'visit')}),
      ${sql.join(tables, sql`, `)},
      visit_segments AS (
        SELECT ${events.sessionId}::text AS "subject",
          coalesce(${segmentOfVisit(by)}, ${UNKNOWN_SEGMENT}) AS "segment"
        FROM ${events}
        WHERE ${inScope(scope)}
        GROUP BY ${events.sessionId}
      )
      SELECT visit_segments."segment" AS "segment",
        to_jsonb(ARRAY[${sql.join(counts, sql`, `)}]) AS "counts"
      FROM ${stepName(0)}
      JOIN visit_segments USING ("subject")
      ${sql.join(joins, sql` `)}
      GROUP BY visit_segments."segment"
      ORDER BY count(${stepName(0)}."subject") DESC, visit_segments."segment"`);
    return rows.map((row) => ({ segment: row.segment, counts: row.counts.map(Number) }));
  }
}

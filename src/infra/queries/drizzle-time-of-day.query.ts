import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { QueryScope } from '../../domain/queries/query-scope';
import type { TimeOfDayQuery, VisitStartCell } from '../../domain/queries/time-of-day';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { events } from '../database/schema/events';
import { inScope, isPageView } from './definitions';

@Injectable()
export class DrizzleTimeOfDayQuery implements TimeOfDayQuery {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async visitStarts(scope: QueryScope): Promise<readonly VisitStartCell[]> {
    const rows = await this.db.execute<{ weekday: number; hour: number; visits: number }>(sql`
      SELECT extract(isodow FROM "startedAt")::int AS "weekday",
        extract(hour FROM "startedAt")::int AS "hour",
        count(*)::int AS "visits"
      FROM (
        SELECT min(${events.occurredAt}) AT TIME ZONE ${scope.timeZone} AS "startedAt"
        FROM ${events}
        WHERE ${inScope(scope)} AND ${isPageView}
        GROUP BY ${events.sessionId}
      ) AS "visitStarts"
      GROUP BY 1, 2
      ORDER BY 1, 2`);
    return [...rows];
  }
}

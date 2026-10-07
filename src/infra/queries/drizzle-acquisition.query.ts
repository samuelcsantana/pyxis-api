import { Inject, Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';
import {
  type AcquisitionQuery,
  type ChannelDayCount,
  DIRECT_SOURCE,
  type SourceCount,
} from '../../domain/queries/acquisition';
import type { QueryScope } from '../../domain/queries/query-scope';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { events } from '../database/schema/events';
import { inScope, isConversion, isPageView, localDay } from './definitions';

function sessionEntries(scope: QueryScope): SQL {
  return sql`
    SELECT DISTINCT ON (${events.sessionId})
      ${events.sessionId} AS "sessionId",
      ${events.channel} AS "channel",
      ${events.fromAdClick} AS "fromAdClick",
      coalesce(${events.utmSource}, ${events.referrerHost}, ${DIRECT_SOURCE}) AS "source",
      ${events.utmMedium} AS "medium",
      ${localDay(scope)} AS "date"
    FROM ${events}
    WHERE ${inScope(scope)} AND ${isPageView} AND ${events.channel} IS NOT NULL
    ORDER BY ${events.sessionId}, ${events.occurredAt}`;
}

@Injectable()
export class DrizzleAcquisitionQuery implements AcquisitionQuery {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async visitsByDayAndChannel(scope: QueryScope): Promise<readonly ChannelDayCount[]> {
    const rows = await this.db.execute<{
      -readonly [Key in keyof ChannelDayCount]: ChannelDayCount[Key];
    }>(sql`
      WITH entries AS (${sessionEntries(scope)})
      SELECT "date", "channel", count(*)::int AS "visits"
      FROM entries
      GROUP BY "date", "channel"
      ORDER BY "date", "channel"`);
    return [...rows];
  }

  async sources(scope: QueryScope, limit: number): Promise<readonly SourceCount[]> {
    const rows = await this.db.execute<{
      -readonly [Key in keyof SourceCount]: SourceCount[Key];
    }>(sql`
      WITH entries AS (${sessionEntries(scope)}),
      conversions AS (
        SELECT ${events.sessionId} AS "sessionId", count(*)::int AS "conversions"
        FROM ${events}
        WHERE ${inScope(scope)} AND ${isConversion(scope)}
        GROUP BY ${events.sessionId}
      )
      SELECT entries."source", entries."medium", entries."channel",
        count(*)::int AS "visits",
        coalesce(sum(conversions."conversions"), 0)::int AS "conversions",
        count(conversions."sessionId")::int AS "convertingVisits",
        count(*) FILTER (WHERE entries."fromAdClick")::int AS "fromAdClickVisits"
      FROM entries
      LEFT JOIN conversions ON conversions."sessionId" = entries."sessionId"
      GROUP BY entries."source", entries."medium", entries."channel"
      ORDER BY "visits" DESC, entries."source", entries."medium" NULLS FIRST
      LIMIT ${limit}`);
    return [...rows];
  }
}

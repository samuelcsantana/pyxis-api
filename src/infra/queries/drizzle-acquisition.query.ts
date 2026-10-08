import { Inject, Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';
import type {
  AcquisitionQuery,
  CampaignCount,
  ChannelDayCount,
  SourceCount,
} from '../../domain/queries/acquisition';
import type { QueryScope } from '../../domain/queries/query-scope';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { events } from '../database/schema/events';
import { entrySource, inScope, isConversion, isEntryPageView, localDay } from './definitions';

function sessionEntries(scope: QueryScope): SQL {
  return sql`
    SELECT DISTINCT ON (${events.sessionId})
      ${events.sessionId} AS "sessionId",
      ${events.channel} AS "channel",
      ${events.fromAdClick} AS "fromAdClick",
      ${entrySource} AS "source",
      ${events.utmMedium} AS "medium",
      ${events.utmCampaign} AS "campaign",
      ${localDay(scope)} AS "date"
    FROM ${events}
    WHERE ${inScope(scope)} AND ${isEntryPageView}
    ORDER BY ${events.sessionId}, ${events.occurredAt}`;
}

interface EntryGrouping {
  readonly keys: SQL;
  readonly order: SQL;
  readonly only: SQL;
}

const BY_SOURCE: EntryGrouping = {
  keys: sql`entries."source", entries."medium", entries."channel"`,
  order: sql`entries."source", entries."medium" NULLS FIRST`,
  only: sql`true`,
};

const BY_CAMPAIGN: EntryGrouping = {
  keys: sql`entries."campaign", entries."source", entries."medium", entries."channel"`,
  order: sql`entries."campaign", entries."source", entries."medium" NULLS FIRST`,
  only: sql`entries."campaign" IS NOT NULL`,
};

function entryTotals(scope: QueryScope, grouping: EntryGrouping, limit: number): SQL {
  return sql`
    WITH entries AS (${sessionEntries(scope)}),
    conversions AS (
      SELECT ${events.sessionId} AS "sessionId", count(*)::int AS "conversions"
      FROM ${events}
      WHERE ${inScope(scope)} AND ${isConversion(scope)}
      GROUP BY ${events.sessionId}
    )
    SELECT ${grouping.keys},
      count(*)::int AS "visits",
      coalesce(sum(conversions."conversions"), 0)::int AS "conversions",
      count(conversions."sessionId")::int AS "convertingVisits",
      count(*) FILTER (WHERE entries."fromAdClick")::int AS "fromAdClickVisits"
    FROM entries
    LEFT JOIN conversions ON conversions."sessionId" = entries."sessionId"
    WHERE ${grouping.only}
    GROUP BY ${grouping.keys}
    ORDER BY "visits" DESC, ${grouping.order}
    LIMIT ${limit}`;
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
    }>(entryTotals(scope, BY_SOURCE, limit));
    return [...rows];
  }

  async campaigns(scope: QueryScope, limit: number): Promise<readonly CampaignCount[]> {
    const rows = await this.db.execute<{
      -readonly [Key in keyof CampaignCount]: CampaignCount[Key];
    }>(entryTotals(scope, BY_CAMPAIGN, limit));
    return [...rows];
  }
}

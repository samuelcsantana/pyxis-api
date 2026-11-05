import { Inject, Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';
import type { VisitorKind } from '../../domain/events/visitor-kind';
import type {
  DayTotals,
  EventCount,
  OverviewQuery,
  PageCount,
  PeriodTotals,
} from '../../domain/queries/overview';
import type { QueryScope } from '../../domain/queries/query-scope';
import type { VisitorDay, VisitorKindCounts } from '../../domain/queries/visitors';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { events } from '../database/schema/events';
import type { RevenueDay } from '../../domain/queries/revenue';
import {
  conversionRevenue,
  isNamedEvent,
  isPageView,
  localDay,
  periodTotalsColumns,
} from './definitions';
import { inScope } from './report-filters';

function firstVisitorKinds(scope: QueryScope): SQL {
  return sql`
    SELECT DISTINCT ON (${events.sessionId})
      ${events.visitor} AS "visitor",
      ${localDay(scope)} AS "date"
    FROM ${events}
    WHERE ${inScope(scope)} AND ${events.visitor} IS NOT NULL
    ORDER BY ${events.sessionId}, ${events.occurredAt}`;
}

function visitsOfKind(kind: VisitorKind): SQL {
  return sql`count(*) FILTER (WHERE firsts."visitor" = ${kind})::int`;
}

@Injectable()
export class DrizzleOverviewQuery implements OverviewQuery {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async totals(scope: QueryScope): Promise<PeriodTotals> {
    const rows = await this.db.execute<Record<keyof PeriodTotals, number>>(sql`
      SELECT ${periodTotalsColumns(scope)}
      FROM ${events}
      WHERE ${inScope(scope)}`);
    const [aggregate] = rows as unknown as readonly [PeriodTotals];
    return aggregate;
  }

  async revenueTotal(scope: QueryScope): Promise<number> {
    const rows = await this.db.execute<{ revenue: number }>(sql`
      SELECT ${conversionRevenue(scope)} AS "revenue"
      FROM ${events}
      WHERE ${inScope(scope)}`);
    const [aggregate] = rows as unknown as readonly [{ revenue: number }];
    return aggregate.revenue;
  }

  async revenueDays(scope: QueryScope): Promise<readonly RevenueDay[]> {
    const rows = await this.db.execute<{ date: string; revenue: number }>(sql`
      SELECT ${localDay(scope)} AS "date", ${conversionRevenue(scope)} AS "revenue"
      FROM ${events}
      WHERE ${inScope(scope)}
      GROUP BY 1
      ORDER BY 1`);
    return [...rows];
  }

  async days(scope: QueryScope): Promise<readonly DayTotals[]> {
    const rows = await this.db.execute<Record<keyof DayTotals, number> & { date: string }>(sql`
      SELECT ${localDay(scope)} AS "date",
        ${periodTotalsColumns(scope)},
        count(*) FILTER (WHERE ${isPageView})::int AS "pageViews",
        count(*) FILTER (WHERE ${isNamedEvent})::int AS "events"
      FROM ${events}
      WHERE ${inScope(scope)}
      GROUP BY 1
      ORDER BY 1`);
    return [...rows];
  }

  async topPages(scope: QueryScope, limit: number): Promise<readonly PageCount[]> {
    const rows = await this.db.execute<{ path: string; views: number; visits: number }>(sql`
      SELECT ${events.path} AS "path",
        count(*)::int AS "views",
        count(DISTINCT ${events.sessionId})::int AS "visits"
      FROM ${events}
      WHERE ${inScope(scope)} AND ${isPageView}
      GROUP BY ${events.path}
      ORDER BY "views" DESC, "path"
      LIMIT ${limit}`);
    return [...rows];
  }

  async topEvents(scope: QueryScope, limit: number): Promise<readonly EventCount[]> {
    const rows = await this.db.execute<{ name: string; count: number; visits: number }>(sql`
      SELECT ${events.name} AS "name",
        count(*)::int AS "count",
        count(DISTINCT ${events.sessionId})::int AS "visits"
      FROM ${events}
      WHERE ${inScope(scope)} AND ${isNamedEvent}
      GROUP BY ${events.name}
      ORDER BY "count" DESC, "name"
      LIMIT ${limit}`);
    return [...rows];
  }

  async visitorDays(scope: QueryScope): Promise<readonly VisitorDay[]> {
    const rows = await this.db.execute<
      Record<keyof VisitorKindCounts, number> & { date: string }
    >(sql`
      WITH firsts AS (${firstVisitorKinds(scope)})
      SELECT firsts."date",
        ${visitsOfKind('first_visit')} AS "firstVisit",
        ${visitsOfKind('first_this_month')} AS "firstThisMonth",
        ${visitsOfKind('first_today')} AS "firstToday",
        ${visitsOfKind('again_today')} AS "againToday"
      FROM firsts
      GROUP BY firsts."date"
      ORDER BY firsts."date"`);
    return [...rows];
  }
}

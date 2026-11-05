import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import { daysIn, todayIn } from '../../domain/queries/date-range';
import {
  type DayTotals,
  type Kpi,
  OVERVIEW_QUERY,
  type OverviewQuery,
  type OverviewReport,
  type PeriodTotals,
  type PreviousDay,
  TOP_ITEMS,
} from '../../domain/queries/overview';
import type { QueryScope } from '../../domain/queries/query-scope';
import { carriesRevenue } from '../../domain/queries/revenue';
import {
  NO_VISITOR_KINDS,
  type VisitorDay,
  VISITORS_OFF,
  type VisitorsReport,
  visitorMonths,
} from '../../domain/queries/visitors';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { type RequestedRange, scopedPeriods } from './scoped-periods';

const EMPTY_DAY: Omit<DayTotals, 'date'> = {
  visits: 0,
  identifiedUsers: 0,
  conversions: 0,
  convertingVisits: 0,
  writes: 0,
  failedWrites: 0,
  pageViews: 0,
  events: 0,
};

function denseDays(dates: readonly string[], sparse: readonly DayTotals[]): readonly DayTotals[] {
  const byDate = new Map(sparse.map((day) => [day.date, day]));
  return dates.map((date) => byDate.get(date) ?? { ...EMPTY_DAY, date });
}

function denseVisitorDays(
  dates: readonly string[],
  sparse: readonly VisitorDay[],
): readonly VisitorDay[] {
  const byDate = new Map(sparse.map((day) => [day.date, day]));
  return dates.map((date) => byDate.get(date) ?? { ...NO_VISITOR_KINDS, date });
}

function failures(totals: PeriodTotals) {
  return { failed: totals.failedWrites, total: totals.writes };
}

function previousDay(day: DayTotals, scope: QueryScope): PreviousDay {
  return {
    date: day.date,
    pageViews: day.pageViews,
    events: day.events,
    visits: day.visits,
    identifiedUsers: day.identifiedUsers,
    conversions: scope.conversion === null ? null : day.conversions,
    convertingVisits: scope.conversion === null ? null : day.convertingVisits,
    writeErrors: failures(day),
  };
}

@Injectable()
export class GetOverviewUseCase {
  constructor(
    @Inject(OVERVIEW_QUERY) private readonly query: OverviewQuery,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(project: Project, requested: RequestedRange): Promise<OverviewReport> {
    const readAt = this.clock.now();
    const { current, previous, comparisonCutoff } = scopedPeriods(project, requested, readAt);
    const [now, before, sparseDays, sparsePreviousDays, topPages, topEvents, visitors, revenue] =
      await Promise.all([
        this.query.totals(current),
        this.query.totals(previous),
        this.query.days(current),
        this.query.days(previous),
        this.query.topPages(current, TOP_ITEMS),
        this.query.topEvents(current, TOP_ITEMS),
        project.visitorsEnabled
          ? this.visitors(current, previous, todayIn(project.timezone, readAt))
          : VISITORS_OFF,
        carriesRevenue(current.conversion) ? this.revenue(current, previous) : null,
      ]);
    const days = denseDays(daysIn(current.range), sparseDays);
    const previousDays = denseDays(daysIn(previous.range), sparsePreviousDays);
    return {
      kpis: {
        visits: {
          current: now.visits,
          previous: before.visits,
          daily: days.map((day) => day.visits),
        },
        identifiedUsers: {
          current: now.identifiedUsers,
          previous: before.identifiedUsers,
          daily: days.map((day) => day.identifiedUsers),
        },
        conversions:
          current.conversion === null
            ? null
            : {
                current: now.conversions,
                previous: before.conversions,
                daily: days.map((day) => day.conversions),
              },
        convertingVisits:
          current.conversion === null
            ? null
            : {
                current: now.convertingVisits,
                previous: before.convertingVisits,
                daily: days.map((day) => day.convertingVisits),
              },
        revenue,
        writeErrors: {
          current: failures(now),
          previous: failures(before),
          daily: days.map(failures),
        },
      },
      days: days.map((day) => ({ date: day.date, pageViews: day.pageViews, events: day.events })),
      topPages,
      topEvents,
      comparisonCutoff,
      previousDays: previousDays.map((day) => previousDay(day, previous)),
      visitors,
    };
  }

  private async revenue(current: QueryScope, previous: QueryScope): Promise<Kpi> {
    const [now, before, sparseDaily] = await Promise.all([
      this.query.revenueTotal(current),
      this.query.revenueTotal(previous),
      this.query.revenueDays(current),
    ]);
    const byDate = new Map(sparseDaily.map((day) => [day.date, day.revenue]));
    return {
      current: now,
      previous: before,
      daily: daysIn(current.range).map((date) => byDate.get(date) ?? 0),
    };
  }

  private async visitors(
    current: QueryScope,
    previous: QueryScope,
    today: string,
  ): Promise<VisitorsReport> {
    const [sparseDaily, sparsePreviousDaily] = await Promise.all([
      this.query.visitorDays(current),
      this.query.visitorDays(previous),
    ]);
    const daily = denseVisitorDays(daysIn(current.range), sparseDaily);
    const previousDaily = denseVisitorDays(daysIn(previous.range), sparsePreviousDaily);
    return {
      enabled: true,
      daily,
      months: visitorMonths(daily, current, today),
      previousDaily,
      previousMonths: visitorMonths(previousDaily, previous, today),
    };
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import { daysIn } from '../../domain/queries/date-range';
import {
  type DayTotals,
  OVERVIEW_QUERY,
  type OverviewQuery,
  type OverviewReport,
  type PeriodTotals,
  type PreviousDay,
  TOP_ITEMS,
} from '../../domain/queries/overview';
import type { QueryScope } from '../../domain/queries/query-scope';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { type RequestedRange, scopedPeriods } from './scoped-periods';

const EMPTY_DAY: Omit<DayTotals, 'date'> = {
  visits: 0,
  identifiedUsers: 0,
  conversions: 0,
  writes: 0,
  failedWrites: 0,
  pageViews: 0,
  events: 0,
};

function denseDays(dates: readonly string[], sparse: readonly DayTotals[]): readonly DayTotals[] {
  const byDate = new Map(sparse.map((day) => [day.date, day]));
  return dates.map((date) => byDate.get(date) ?? { ...EMPTY_DAY, date });
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
    conversions: scope.conversionEvent === null ? null : day.conversions,
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
    const { current, previous, comparisonCutoff } = scopedPeriods(
      project,
      requested,
      this.clock.now(),
    );
    const [now, before, sparseDays, sparsePreviousDays, topPages, topEvents] = await Promise.all([
      this.query.totals(current),
      this.query.totals(previous),
      this.query.days(current),
      this.query.days(previous),
      this.query.topPages(current, TOP_ITEMS),
      this.query.topEvents(current, TOP_ITEMS),
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
          project.conversionEvent === null
            ? null
            : {
                current: now.conversions,
                previous: before.conversions,
                daily: days.map((day) => day.conversions),
              },
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
    };
  }
}

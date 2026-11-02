import { shiftDays } from './date-range';
import type { QueryScope } from './query-scope';

const MONTH_LENGTH = 7;
const FIRST_OF_MONTH = '-01';

export interface VisitorKindCounts {
  readonly firstVisit: number;
  readonly firstThisMonth: number;
  readonly firstToday: number;
  readonly againToday: number;
}

export interface VisitorDay extends VisitorKindCounts {
  readonly date: string;
}

export interface VisitorMonth {
  readonly month: string;
  readonly firstVisit: number;
  readonly firstThisMonth: number;
  readonly exact: boolean;
}

export interface VisitorsReport {
  readonly enabled: boolean;
  readonly daily: readonly VisitorDay[];
  readonly months: readonly VisitorMonth[];
  readonly previousDaily: readonly VisitorDay[];
  readonly previousMonths: readonly VisitorMonth[];
}

export const NO_VISITOR_KINDS: VisitorKindCounts = {
  firstVisit: 0,
  firstThisMonth: 0,
  firstToday: 0,
  againToday: 0,
};

export const VISITORS_OFF: VisitorsReport = {
  enabled: false,
  daily: [],
  months: [],
  previousDaily: [],
  previousMonths: [],
};

function monthOf(isoDate: string): string {
  return isoDate.slice(0, MONTH_LENGTH);
}

function isLastDayOfMonth(isoDate: string): boolean {
  return shiftDays(isoDate, 1).endsWith(FIRST_OF_MONTH);
}

function isExact(month: string, scope: QueryScope, today: string): boolean {
  const { from, to } = scope.range;
  if (from > `${month}${FIRST_OF_MONTH}`) {
    return false;
  }
  if (monthOf(to) !== month) {
    return true;
  }
  if (scope.lastDayUntil !== undefined) {
    return false;
  }
  return to === today || isLastDayOfMonth(to);
}

function sumOf(days: readonly VisitorDay[], kind: keyof VisitorKindCounts): number {
  return days.reduce((total, day) => total + day[kind], 0);
}

export function visitorMonths(
  days: readonly VisitorDay[],
  scope: QueryScope,
  today: string,
): readonly VisitorMonth[] {
  const months = [...new Set(days.map((day) => monthOf(day.date)))];
  return months.map((month) => {
    const inMonth = days.filter((day) => monthOf(day.date) === month);
    return {
      month,
      firstVisit: sumOf(inMonth, 'firstVisit'),
      firstThisMonth: sumOf(inMonth, 'firstThisMonth'),
      exact: isExact(month, scope, today),
    };
  });
}

import { daysIn } from './date-range';
import type { QueryScope } from './query-scope';
import { NO_REPORT_FILTERS } from './report-filters';
import { NO_VISITOR_KINDS, type VisitorDay, visitorMonths } from './visitors';

const TODAY = '2026-11-02';

function scopeOf(from: string, to: string, lastDayUntil?: string): QueryScope {
  return {
    projectId: 'c1d2e3f4-a5b6-4c7d-8e9f-a0b1c2d3e4f5',
    timeZone: 'America/Sao_Paulo',
    conversion: null,
    range: { from, to },
    filters: NO_REPORT_FILTERS,
    ...(lastDayUntil === undefined ? {} : { lastDayUntil }),
  };
}

function quietDays(scope: QueryScope): readonly VisitorDay[] {
  return daysIn(scope.range).map((date) => ({ ...NO_VISITOR_KINDS, date }));
}

function exactness(scope: QueryScope, today = TODAY) {
  return visitorMonths(quietDays(scope), scope, today).map(({ month, exact }) => ({
    month,
    exact,
  }));
}

describe('visitorMonths', () => {
  it('adds up first visits and first visits this month per month, leaving the other kinds out', () => {
    const scope = scopeOf('2026-09-30', '2026-10-02');
    const days: readonly VisitorDay[] = [
      { date: '2026-09-30', firstVisit: 4, firstThisMonth: 1, firstToday: 7, againToday: 9 },
      { date: '2026-10-01', firstVisit: 2, firstThisMonth: 3, firstToday: 5, againToday: 8 },
      { date: '2026-10-02', firstVisit: 1, firstThisMonth: 6, firstToday: 2, againToday: 4 },
    ];

    expect(visitorMonths(days, scope, TODAY)).toEqual([
      { month: '2026-09', firstVisit: 4, firstThisMonth: 1, exact: false },
      { month: '2026-10', firstVisit: 3, firstThisMonth: 9, exact: false },
    ]);
  });

  it('answers no month for no day', () => {
    expect(visitorMonths([], scopeOf('2026-10-01', '2026-10-31'), TODAY)).toEqual([]);
  });

  it('calls a month exact when the range holds all of it', () => {
    expect(exactness(scopeOf('2026-10-01', '2026-10-31'))).toEqual([
      { month: '2026-10', exact: true },
    ]);
  });

  it('calls the month exact when the range runs from its first day to today', () => {
    expect(exactness(scopeOf('2026-11-01', TODAY))).toEqual([{ month: '2026-11', exact: true }]);
  });

  it('calls a month partial when the range starts after its first day', () => {
    expect(exactness(scopeOf('2026-10-15', '2026-10-31'))).toEqual([
      { month: '2026-10', exact: false },
    ]);
  });

  it('calls a month partial when the range ends before its last day and before today', () => {
    expect(exactness(scopeOf('2026-10-01', '2026-10-20'))).toEqual([
      { month: '2026-10', exact: false },
    ]);
  });

  it('judges each month a long range touches on its own', () => {
    expect(exactness(scopeOf('2026-09-15', TODAY))).toEqual([
      { month: '2026-09', exact: false },
      { month: '2026-10', exact: true },
      { month: '2026-11', exact: true },
    ]);
  });

  it('calls a month partial when the range stops at a time of its last day', () => {
    expect(exactness(scopeOf('2026-09-01', '2026-10-31', '12:00:00.000'))).toEqual([
      { month: '2026-09', exact: true },
      { month: '2026-10', exact: false },
    ]);
  });

  it('calls a month partial when a range cut at a time of day ends inside it, even on today', () => {
    expect(exactness(scopeOf('2026-11-01', TODAY, '12:00:00.000'))).toEqual([
      { month: '2026-11', exact: false },
    ]);
  });

  it('finds the last day of February in a leap year', () => {
    expect(exactness(scopeOf('2028-02-01', '2028-02-29'))).toEqual([
      { month: '2028-02', exact: true },
    ]);
    expect(exactness(scopeOf('2027-02-01', '2027-02-28'))).toEqual([
      { month: '2027-02', exact: true },
    ]);
    expect(exactness(scopeOf('2028-02-01', '2028-02-28'))).toEqual([
      { month: '2028-02', exact: false },
    ]);
  });
});

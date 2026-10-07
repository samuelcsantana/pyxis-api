import type { QueryScope } from './query-scope';

export const TOP_ITEMS = 10;

export interface PeriodTotals {
  readonly visits: number;
  readonly identifiedUsers: number;
  readonly conversions: number;
  readonly convertingVisits: number;
  readonly writes: number;
  readonly failedWrites: number;
}

export interface DayTotals extends PeriodTotals {
  readonly date: string;
  readonly pageViews: number;
  readonly events: number;
}

export interface PageCount {
  readonly path: string;
  readonly views: number;
  readonly visits: number;
}

export interface EventCount {
  readonly name: string;
  readonly count: number;
  readonly visits: number;
}

export interface OverviewQuery {
  totals(scope: QueryScope): Promise<PeriodTotals>;
  days(scope: QueryScope): Promise<readonly DayTotals[]>;
  topPages(scope: QueryScope, limit: number): Promise<readonly PageCount[]>;
  topEvents(scope: QueryScope, limit: number): Promise<readonly EventCount[]>;
}

export const OVERVIEW_QUERY = Symbol('OverviewQuery');

export interface Kpi {
  readonly current: number;
  readonly previous: number;
  readonly daily: readonly number[];
}

export interface FailureCount {
  readonly failed: number;
  readonly total: number;
}

export interface WriteErrorsKpi {
  readonly current: FailureCount;
  readonly previous: FailureCount;
  readonly daily: readonly FailureCount[];
}

export interface DayActivity {
  readonly date: string;
  readonly pageViews: number;
  readonly events: number;
}

export interface PreviousDay extends DayActivity {
  readonly visits: number;
  readonly identifiedUsers: number;
  readonly conversions: number | null;
  readonly convertingVisits: number | null;
  readonly writeErrors: FailureCount;
}

export interface OverviewReport {
  readonly kpis: {
    readonly visits: Kpi;
    readonly identifiedUsers: Kpi;
    readonly conversions: Kpi | null;
    readonly convertingVisits: Kpi | null;
    readonly writeErrors: WriteErrorsKpi;
  };
  readonly days: readonly DayActivity[];
  readonly topPages: readonly PageCount[];
  readonly topEvents: readonly EventCount[];
  readonly comparisonCutoff: string | null;
  readonly previousDays: readonly PreviousDay[];
}

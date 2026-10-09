import type { DateRange } from '../queries/date-range';
import type { EventCount, FailureCount, PageCount } from '../queries/overview';

export const DIGEST_TOP_ITEMS = 5;
export const DIGEST_FAILING_ROUTES = 3;

export interface WeekOverWeek {
  readonly current: number;
  readonly previous: number;
}

export interface DayVisits {
  readonly date: string;
  readonly visits: number;
}

export interface FailingRoute {
  readonly method: string;
  readonly route: string;
  readonly failed: number;
  readonly total: number;
}

export interface WeeklyDigest {
  readonly projectId: string;
  readonly projectName: string;
  readonly timeZone: string;
  readonly week: DateRange;
  readonly visits: WeekOverWeek;
  readonly identifiedUsers: WeekOverWeek;
  readonly convertingVisits: WeekOverWeek | null;
  readonly failedWrites: {
    readonly current: FailureCount;
    readonly previous: FailureCount;
  };
  readonly days: readonly DayVisits[];
  readonly topPages: readonly PageCount[];
  readonly topEvents: readonly EventCount[];
  readonly failingRoutes: readonly FailingRoute[];
  readonly lastEventAt: Date | null;
}

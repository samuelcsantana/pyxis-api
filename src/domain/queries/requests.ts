import type { QueryScope } from './query-scope';

export const TOP_ROUTES = 50;
export const RECENT_FAILURES_PER_ROUTE = 5;
export const REQUEST_KINDS = ['writes', 'reads'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];
export const STATUS_CLASSES = ['success', 'client_error', 'server_error', 'no_response'] as const;
export type StatusClass = (typeof STATUS_CLASSES)[number];

export interface RouteKey {
  readonly method: string;
  readonly route: string;
}

export interface RouteTotal extends RouteKey {
  readonly total: number;
  readonly failed: number;
  readonly medianDurationMs: number;
  readonly p95DurationMs: number;
}

export interface RouteStatusCount extends RouteKey {
  readonly status: number;
  readonly count: number;
}

export interface RouteScreenCount extends RouteKey {
  readonly path: string;
  readonly failed: number;
}

export interface RouteFailure extends RouteKey {
  readonly occurredAt: Date;
  readonly status: number;
  readonly errorCode: string | null;
  readonly sessionId: string;
}

export interface StatusClassDayCount {
  readonly date: string;
  readonly statusClass: StatusClass;
  readonly count: number;
}

export interface RouteDayDurations {
  readonly date: string;
  readonly total: number;
  readonly failed: number;
  readonly medianDurationMs: number;
  readonly p95DurationMs: number;
}

export interface RequestsScope extends QueryScope {
  readonly screen: string | null;
  readonly kind: RequestKind;
}

export interface RequestsQuery {
  routes(scope: RequestsScope, limit: number): Promise<readonly RouteTotal[]>;
  statuses(scope: RequestsScope): Promise<readonly RouteStatusCount[]>;
  screens(scope: RequestsScope): Promise<readonly RouteScreenCount[]>;
  recentFailures(scope: RequestsScope, perRoute: number): Promise<readonly RouteFailure[]>;
  statusClassesByDay(scope: RequestsScope): Promise<readonly StatusClassDayCount[]>;
  routeDays(scope: RequestsScope, route: RouteKey): Promise<readonly RouteDayDurations[]>;
}

export const REQUESTS_QUERY = Symbol('RequestsQuery');

export interface RouteReport extends RouteTotal {
  readonly statuses: readonly { readonly status: number; readonly count: number }[];
  readonly screens: readonly { readonly path: string; readonly failed: number }[];
  readonly recentFailures: readonly Omit<RouteFailure, keyof RouteKey>[];
}

export type StatusClassCounts = Readonly<Record<StatusClass, number>>;

export interface DayStatusClasses {
  readonly date: string;
  readonly byStatusClass: StatusClassCounts;
}

export interface RouteDay {
  readonly date: string;
  readonly total: number;
  readonly failed: number;
  readonly medianDurationMs: number | null;
  readonly p95DurationMs: number | null;
}

export interface RequestsReport {
  readonly kind: RequestKind;
  readonly routes: readonly RouteReport[];
  readonly days: readonly DayStatusClasses[];
  readonly routeDays: readonly RouteDay[] | null;
}

export function noStatusClasses(): StatusClassCounts {
  return { success: 0, client_error: 0, server_error: 0, no_response: 0 };
}

export function statusClassesPerDay(
  dates: readonly string[],
  counts: readonly StatusClassDayCount[],
): readonly DayStatusClasses[] {
  return dates.map((date) => ({
    date,
    byStatusClass: counts
      .filter((count) => count.date === date)
      .reduce<StatusClassCounts>(
        (classes, count) => ({
          ...classes,
          [count.statusClass]: classes[count.statusClass] + count.count,
        }),
        noStatusClasses(),
      ),
  }));
}

export function routeDaysPerDay(
  dates: readonly string[],
  durations: readonly RouteDayDurations[],
): readonly RouteDay[] {
  return dates.map(
    (date) =>
      durations.find((day) => day.date === date) ?? {
        date,
        total: 0,
        failed: 0,
        medianDurationMs: null,
        p95DurationMs: null,
      },
  );
}

function sameRoute(key: RouteKey) {
  return (other: RouteKey) => other.method === key.method && other.route === key.route;
}

export function routeReports(
  totals: readonly RouteTotal[],
  statuses: readonly RouteStatusCount[],
  screens: readonly RouteScreenCount[],
  failures: readonly RouteFailure[],
): readonly RouteReport[] {
  return totals.map((total) => ({
    ...total,
    statuses: statuses
      .filter(sameRoute(total))
      .map((entry) => ({ status: entry.status, count: entry.count })),
    screens: screens
      .filter(sameRoute(total))
      .map((entry) => ({ path: entry.path, failed: entry.failed })),
    recentFailures: failures.filter(sameRoute(total)).map((failure) => ({
      occurredAt: failure.occurredAt,
      status: failure.status,
      errorCode: failure.errorCode,
      sessionId: failure.sessionId,
    })),
  }));
}

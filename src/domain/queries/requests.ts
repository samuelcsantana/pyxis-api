import type { QueryScope } from './query-scope';

export const TOP_ROUTES = 50;
export const RECENT_FAILURES_PER_ROUTE = 5;

export interface RouteKey {
  readonly method: string;
  readonly route: string;
}

export interface RouteTotal extends RouteKey {
  readonly total: number;
  readonly failed: number;
  readonly medianDurationMs: number;
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

export interface RequestsScope extends QueryScope {
  readonly screen: string | null;
}

export interface RequestsQuery {
  routes(scope: RequestsScope, limit: number): Promise<readonly RouteTotal[]>;
  statuses(scope: RequestsScope): Promise<readonly RouteStatusCount[]>;
  screens(scope: RequestsScope): Promise<readonly RouteScreenCount[]>;
  recentFailures(scope: RequestsScope, perRoute: number): Promise<readonly RouteFailure[]>;
}

export const REQUESTS_QUERY = Symbol('RequestsQuery');

export interface RouteReport extends RouteTotal {
  readonly statuses: readonly { readonly status: number; readonly count: number }[];
  readonly screens: readonly { readonly path: string; readonly failed: number }[];
  readonly recentFailures: readonly Omit<RouteFailure, keyof RouteKey>[];
}

export interface RequestsReport {
  readonly routes: readonly RouteReport[];
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

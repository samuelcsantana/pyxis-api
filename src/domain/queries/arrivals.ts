import { MAX_OCCURRED_AT_AGE_MS } from '../events/event-limits';
import type { QueryScope } from './query-scope';

export const ARRIVALS_LOOKBACK_MS = MAX_OCCURRED_AT_AGE_MS;
export const ACTIVE_VISIT_WINDOW_MS = 5 * 60 * 1000;
export const MAX_ARRIVAL_TIMES = 100;

const MILLISECONDS_PER_SECOND = 1000;

export interface ArrivalsAsk {
  readonly scope: QueryScope;
  readonly since: Date;
  readonly activeSince: Date;
  readonly limit: number;
}

export interface ArrivalRows {
  readonly visits: readonly Date[];
  readonly conversions: readonly Date[] | null;
  readonly namedEvents: readonly Date[];
  readonly failedRequests: readonly Date[];
  readonly activeVisits: number;
}

export interface ArrivalsQuery {
  arrivals(ask: ArrivalsAsk): Promise<ArrivalRows>;
}

export const ARRIVALS_QUERY = Symbol('ArrivalsQuery');

export interface ArrivalTimes {
  readonly times: readonly Date[];
  readonly more: boolean;
}

export interface ArrivalsReport {
  readonly asOf: Date;
  readonly activeVisits: number;
  readonly visits: ArrivalTimes;
  readonly conversions: ArrivalTimes | null;
  readonly namedEvents: ArrivalTimes;
  readonly failedRequests: ArrivalTimes;
}

export function clampedSince(requested: Date, asOf: Date): Date {
  const earliest = asOf.getTime() - ARRIVALS_LOOKBACK_MS;
  return new Date(Math.min(Math.max(requested.getTime(), earliest), asOf.getTime()));
}

export function arrivalsAsk(scope: QueryScope, requestedSince: Date, asOf: Date): ArrivalsAsk {
  return {
    scope,
    since: clampedSince(requestedSince, asOf),
    activeSince: new Date(asOf.getTime() - ACTIVE_VISIT_WINDOW_MS),
    limit: MAX_ARRIVAL_TIMES + 1,
  };
}

function upToTheSecond(time: Date): Date {
  return new Date(Math.ceil(time.getTime() / MILLISECONDS_PER_SECOND) * MILLISECONDS_PER_SECOND);
}

export function arrivalTimes(newestFirst: readonly Date[]): ArrivalTimes {
  return {
    times: newestFirst.slice(0, MAX_ARRIVAL_TIMES).map(upToTheSecond),
    more: newestFirst.length > MAX_ARRIVAL_TIMES,
  };
}

export function arrivalsReport(rows: ArrivalRows, asOf: Date): ArrivalsReport {
  return {
    asOf,
    activeVisits: rows.activeVisits,
    visits: arrivalTimes(rows.visits),
    conversions: rows.conversions === null ? null : arrivalTimes(rows.conversions),
    namedEvents: arrivalTimes(rows.namedEvents),
    failedRequests: arrivalTimes(rows.failedRequests),
  };
}

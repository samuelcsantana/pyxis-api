import type { Channel, DeviceType } from '../entities/tracked-event.entity';
import type { ApiRequestMethod } from '../events/reserved-event-names';
import type { QueryScope } from './query-scope';

export const VISIT_LIST_PAGE_SIZE = 50;
export const MAX_VISIT_PATH_FILTERS = 3;
export const MAX_VISIT_HIGHLIGHTS = 5;

export const VISIT_IDENTITIES = ['identified', 'anonymous'] as const;
export type VisitIdentity = (typeof VISIT_IDENTITIES)[number];

export interface VisitPropertyFilter {
  readonly key: string;
  readonly value: string;
}

export interface VisitEventFilter {
  readonly name: string;
  readonly property: VisitPropertyFilter | null;
}

export interface VisitRouteFilter {
  readonly method: ApiRequestMethod;
  readonly route: string;
}

export interface VisitFilters {
  readonly paths: readonly string[];
  readonly event: VisitEventFilter | null;
  readonly channel: Channel | null;
  readonly deviceType: DeviceType | null;
  readonly identity: VisitIdentity | null;
  readonly country: string | null;
  readonly source: string | null;
  readonly campaign: string | null;
  readonly route: VisitRouteFilter | null;
  readonly failed: boolean;
}

export const NO_VISIT_FILTERS: VisitFilters = {
  paths: [],
  event: null,
  channel: null,
  deviceType: null,
  identity: null,
  country: null,
  source: null,
  campaign: null,
  route: null,
  failed: false,
};

export interface VisitCursor {
  readonly startedAt: Date;
  readonly sessionId: string;
}

export interface VisitListItem {
  readonly sessionId: string;
  readonly startedAt: Date;
  readonly endedAt: Date;
  readonly entryPath: string | null;
  readonly pageViews: number;
  readonly highlights: readonly string[];
  readonly failedRequests: number;
  readonly deviceType: string;
  readonly browser: string;
  readonly os: string;
  readonly country: string | null;
  readonly channel: Channel | null;
  readonly source: string | null;
  readonly campaign: string | null;
  readonly userId: string | null;
}

export interface VisitMatches {
  readonly items: readonly VisitListItem[];
  readonly total: number;
}

export interface VisitsQuery {
  list(
    scope: QueryScope,
    filters: VisitFilters,
    after: VisitCursor | null,
    limit: number,
  ): Promise<VisitMatches>;
}

export const VISITS_QUERY = Symbol('VisitsQuery');

export interface VisitsReport {
  readonly visits: readonly VisitListItem[];
  readonly nextCursor: VisitCursor | null;
  readonly total: number;
}

export function visitsPage(matches: VisitMatches, pageSize: number): VisitsReport {
  const visits = matches.items.slice(0, pageSize);
  const [last] = matches.items.length > pageSize ? visits.slice(-1) : [];
  return {
    visits,
    nextCursor:
      last === undefined ? null : { startedAt: last.startedAt, sessionId: last.sessionId },
    total: matches.total,
  };
}

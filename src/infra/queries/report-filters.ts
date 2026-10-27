import { type SQL, sql, type SQLWrapper } from 'drizzle-orm';
import { likePattern } from '../../domain/queries/funnel';
import type {
  ReportFilters,
  VisitEventFilter,
  VisitIdentity,
} from '../../domain/queries/report-filters';
import { events } from '../database/schema/events';
import { entrySource, isEntryPageView, isFailedRequest, isPageView } from './definitions';

function pageConditions(paths: readonly string[]): readonly SQL[] {
  return paths.map(
    (path) => sql`bool_or(${isPageView} AND ${events.path} LIKE ${likePattern(path)} ESCAPE '\\')`,
  );
}

function eventConditions(event: VisitEventFilter | null): readonly SQL[] {
  if (event === null) {
    return [];
  }
  const carries =
    event.property === null
      ? sql``
      : sql` AND ${events.properties}->>${event.property.key} = ${event.property.value}`;
  return [sql`bool_or(${events.name} = ${event.name}${carries})`];
}

function anyEventWith(column: SQLWrapper, wanted: string | null): readonly SQL[] {
  return wanted === null ? [] : [sql`bool_or(${column} = ${wanted})`];
}

function entryWith(value: SQLWrapper, wanted: string | null): readonly SQL[] {
  return wanted === null ? [] : [sql`bool_or(${isEntryPageView} AND ${value} = ${wanted})`];
}

function identityConditions(identity: VisitIdentity | null): readonly SQL[] {
  if (identity === null) {
    return [];
  }
  const identified = sql`bool_or(${events.userId} IS NOT NULL)`;
  return [identity === 'identified' ? identified : sql`NOT ${identified}`];
}

function failureConditions(failed: boolean): readonly SQL[] {
  return failed ? [sql`bool_or(${isFailedRequest})`] : [];
}

export function reportFilterConditions(filters: ReportFilters): readonly SQL[] {
  return [
    ...pageConditions(filters.paths),
    ...eventConditions(filters.event),
    ...anyEventWith(events.channel, filters.channel),
    ...anyEventWith(events.deviceType, filters.deviceType),
    ...identityConditions(filters.identity),
    ...anyEventWith(events.country, filters.country),
    ...anyEventWith(events.region, filters.region),
    ...entryWith(entrySource, filters.source),
    ...entryWith(events.utmCampaign, filters.campaign),
    ...failureConditions(filters.failed),
  ];
}

import type { QueryScope } from './query-scope';

export const TOP_SUMMARY_GROUPS = 10;

export interface NumericSummary {
  readonly events: number;
  readonly median: number | null;
  readonly p25: number | null;
  readonly p75: number | null;
}

export interface GroupedSummary extends NumericSummary {
  readonly value: string;
}

export interface PropertySummaryRequest {
  readonly name: string;
  readonly key: string;
  readonly by: string | null;
}

export interface PropertySummaryCounts {
  readonly overall: NumericSummary;
  readonly groups: readonly GroupedSummary[];
  readonly groupedEvents: number;
}

export interface PropertySummaryQuery {
  summarize(
    scope: QueryScope,
    request: PropertySummaryRequest,
    groups: number,
  ): Promise<PropertySummaryCounts>;
}

export const PROPERTY_SUMMARY_QUERY = Symbol('PropertySummaryQuery');

export interface PropertySummaryReport extends PropertySummaryRequest {
  readonly overall: NumericSummary;
  readonly groups: readonly GroupedSummary[];
  readonly otherCount: number;
}

function byEventsThenValue(left: GroupedSummary, right: GroupedSummary): number {
  return right.events - left.events || left.value.localeCompare(right.value);
}

export function propertySummaryOf(
  request: PropertySummaryRequest,
  counts: PropertySummaryCounts,
): PropertySummaryReport {
  const groups = counts.groups.toSorted(byEventsThenValue);
  const shown = groups.reduce((sum, group) => sum + group.events, 0);
  return {
    ...request,
    overall: counts.overall,
    groups,
    otherCount: counts.groupedEvents - shown,
  };
}

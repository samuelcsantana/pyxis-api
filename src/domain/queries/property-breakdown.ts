import type { QueryScope } from './query-scope';

export const TOP_PROPERTY_VALUES = 10;

export interface PropertyValueCount {
  readonly key: string;
  readonly value: string;
  readonly count: number;
  readonly visits: number;
  readonly keyEvents: number;
}

export interface PropertyCounts {
  readonly events: number;
  readonly values: readonly PropertyValueCount[];
}

export interface PropertyBreakdownQuery {
  counts(scope: QueryScope, name: string, valuesPerKey: number): Promise<PropertyCounts>;
}

export const PROPERTY_BREAKDOWN_QUERY = Symbol('PropertyBreakdownQuery');

export interface PropertyValueShare {
  readonly value: string;
  readonly count: number;
  readonly visits: number;
}

export interface PropertyKeyBreakdown {
  readonly key: string;
  readonly events: number;
  readonly values: readonly PropertyValueShare[];
  readonly otherCount: number;
}

export interface PropertyBreakdownReport {
  readonly name: string;
  readonly events: number;
  readonly keys: readonly PropertyKeyBreakdown[];
}

function byCountThenValue(left: PropertyValueShare, right: PropertyValueShare): number {
  return right.count - left.count || left.value.localeCompare(right.value);
}

function byEventsThenKey(left: PropertyKeyBreakdown, right: PropertyKeyBreakdown): number {
  return right.events - left.events || left.key.localeCompare(right.key);
}

function keyBreakdown(key: string, counts: readonly PropertyValueCount[]): PropertyKeyBreakdown {
  const values = counts
    .map(({ value, count, visits }) => ({ value, count, visits }))
    .toSorted(byCountThenValue);
  const events = Math.max(...counts.map((count) => count.keyEvents));
  const shown = values.reduce((sum, value) => sum + value.count, 0);
  return { key, events, values, otherCount: events - shown };
}

export function breakdownByKey(
  values: readonly PropertyValueCount[],
): readonly PropertyKeyBreakdown[] {
  const keys = [...new Set(values.map((value) => value.key))];
  return keys
    .map((key) =>
      keyBreakdown(
        key,
        values.filter((value) => value.key === key),
      ),
    )
    .toSorted(byEventsThenKey);
}

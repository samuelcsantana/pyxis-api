import type { QueryScope } from './query-scope';

export const FEATURE_KINDS = ['events', 'screens'] as const;
export type FeatureKind = (typeof FEATURE_KINDS)[number];

export const TOP_FEATURES = 50;

export interface FeatureTotal {
  readonly name: string;
  readonly count: number;
  readonly visits: number;
}

export interface FeatureDayCount {
  readonly name: string;
  readonly date: string;
  readonly count: number;
}

export interface FeaturesQuery {
  totals(scope: QueryScope, kind: FeatureKind, limit: number): Promise<readonly FeatureTotal[]>;
  days(
    scope: QueryScope,
    kind: FeatureKind,
    names: readonly string[],
  ): Promise<readonly FeatureDayCount[]>;
}

export const FEATURES_QUERY = Symbol('FeaturesQuery');

export interface FeatureUsage extends FeatureTotal {
  readonly daily: readonly number[];
}

export interface FeaturesReport {
  readonly items: readonly FeatureUsage[];
}

export function withDailyCounts(
  totals: readonly FeatureTotal[],
  dates: readonly string[],
  days: readonly FeatureDayCount[],
): readonly FeatureUsage[] {
  const counts = new Map(days.map((day) => [`${day.name}\u0000${day.date}`, day.count]));
  return totals.map((total) => ({
    ...total,
    daily: dates.map((date) => counts.get(`${total.name}\u0000${date}`) ?? 0),
  }));
}

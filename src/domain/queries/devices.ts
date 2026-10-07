import type { QueryScope } from './query-scope';

export type DeviceDimension = 'deviceType' | 'browser' | 'os' | 'country';

export const TOP_DEVICE_VALUES = 5;
export const OTHER_VALUE = 'other';

export interface ValueCount {
  readonly value: string | null;
  readonly visits: number;
  readonly conversions: number;
  readonly convertingVisits: number;
}

export interface DevicesQuery {
  breakdown(scope: QueryScope, dimension: DeviceDimension): Promise<readonly ValueCount[]>;
}

export const DEVICES_QUERY = Symbol('DevicesQuery');

export interface ValueShare {
  readonly value: string;
  readonly visits: number;
  readonly conversions: number | null;
  readonly convertingVisits: number | null;
}

export type DevicesReport = Readonly<Record<DeviceDimension, readonly ValueShare[]>>;

export function topValuesAndOther(
  counts: readonly ValueCount[],
  countConversions: boolean,
): readonly ValueShare[] {
  const ranked = counts
    .filter((count): count is ValueCount & { value: string } => count.value !== null)
    .toSorted((left, right) => right.visits - left.visits || left.value.localeCompare(right.value));
  const top = ranked.slice(0, TOP_DEVICE_VALUES);
  const rest = [
    ...ranked.slice(TOP_DEVICE_VALUES),
    ...counts.filter((count) => count.value === null),
  ];
  const shares = rest.length === 0 ? top : [...top, { value: OTHER_VALUE, ...sum(rest) }];
  return shares.map((share) => ({
    value: share.value,
    visits: share.visits,
    conversions: countConversions ? share.conversions : null,
    convertingVisits: countConversions ? share.convertingVisits : null,
  }));
}

function sum(counts: readonly ValueCount[]) {
  return counts.reduce(
    (total, count) => ({
      visits: total.visits + count.visits,
      conversions: total.conversions + count.conversions,
      convertingVisits: total.convertingVisits + count.convertingVisits,
    }),
    { visits: 0, conversions: 0, convertingVisits: 0 },
  );
}

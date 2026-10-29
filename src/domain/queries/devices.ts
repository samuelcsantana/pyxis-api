import type { QueryScope } from './query-scope';

export type DeviceDimension = 'deviceType' | 'browser' | 'os' | 'country';

export const TOP_DEVICE_VALUES = 5;
export const TOP_REGIONS = 10;
export const TOP_CITIES = 20;
export const OTHER_VALUE = 'other';

export interface ValueCount {
  readonly value: string | null;
  readonly visits: number;
  readonly conversions: number;
  readonly convertingVisits: number;
}

export interface RegionCount {
  readonly region: string | null;
  readonly name: string | null;
  readonly visits: number;
  readonly conversions: number;
  readonly convertingVisits: number;
}

export interface CityCount {
  readonly city: string | null;
  readonly region: string | null;
  readonly regionName: string | null;
  readonly visits: number;
  readonly conversions: number;
  readonly convertingVisits: number;
}

export interface DevicesQuery {
  breakdown(scope: QueryScope, dimension: DeviceDimension): Promise<readonly ValueCount[]>;
  regions(scope: QueryScope): Promise<readonly RegionCount[]>;
  cities(scope: QueryScope): Promise<readonly CityCount[]>;
}

export const DEVICES_QUERY = Symbol('DevicesQuery');

export interface ValueShare {
  readonly value: string;
  readonly visits: number;
  readonly conversions: number | null;
  readonly convertingVisits: number | null;
}

export interface RegionShare {
  readonly value: string | null;
  readonly name: string | null;
  readonly visits: number;
  readonly conversions: number | null;
  readonly convertingVisits: number | null;
}

export interface CityShare {
  readonly value: string | null;
  readonly region: string | null;
  readonly regionName: string | null;
  readonly visits: number;
  readonly conversions: number | null;
  readonly convertingVisits: number | null;
}

export type DevicesReport = Readonly<Record<DeviceDimension, readonly ValueShare[]>> & {
  readonly regions: readonly RegionShare[];
  readonly cities: readonly CityShare[];
};

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
    ...conversionCounts(share, countConversions),
  }));
}

export function topRegionsAndRest(
  counts: readonly RegionCount[],
  countConversions: boolean,
): readonly RegionShare[] {
  const identified = counts
    .filter((count): count is RegionCount & { region: string } => count.region !== null)
    .toSorted(
      (left, right) => right.visits - left.visits || left.region.localeCompare(right.region),
    );
  const unknown = counts.filter((count) => count.region === null);
  const rest = identified.slice(TOP_REGIONS);
  const shares: readonly RegionShare[] = [
    ...identified.slice(0, TOP_REGIONS).map((count) => ({ ...count, value: count.region })),
    ...(rest.length === 0 ? [] : [{ value: OTHER_VALUE, name: null, ...sum(rest) }]),
    ...(unknown.length === 0 ? [] : [{ value: null, name: null, ...sum(unknown) }]),
  ];
  return shares.map((share) => ({
    value: share.value,
    name: share.name,
    ...conversionCounts(share, countConversions),
  }));
}

type PlacedCityCount = CityCount & { readonly city: string; readonly region: string };

function isPlaced(count: CityCount): count is PlacedCityCount {
  return count.city !== null && count.region !== null;
}

export function topCitiesAndRest(
  counts: readonly CityCount[],
  countConversions: boolean,
): readonly CityShare[] {
  const placed = counts
    .filter(isPlaced)
    .toSorted(
      (left, right) =>
        right.visits - left.visits ||
        left.city.localeCompare(right.city) ||
        left.region.localeCompare(right.region),
    );
  const unplaced = counts.filter((count) => !isPlaced(count));
  const rest = placed.slice(TOP_CITIES);
  const shares: readonly CityShare[] = [
    ...placed.slice(0, TOP_CITIES).map((count) => ({ ...count, value: count.city })),
    ...(rest.length === 0
      ? []
      : [{ value: OTHER_VALUE, region: null, regionName: null, ...sum(rest) }]),
    ...(unplaced.length === 0
      ? []
      : [{ value: null, region: null, regionName: null, ...sum(unplaced) }]),
  ];
  return shares.map((share) => ({
    value: share.value,
    region: share.region,
    regionName: share.regionName,
    ...conversionCounts(share, countConversions),
  }));
}

interface Counted {
  readonly visits: number;
  readonly conversions: number | null;
  readonly convertingVisits: number | null;
}

function conversionCounts(share: Counted, countConversions: boolean): Counted {
  return {
    visits: share.visits,
    conversions: countConversions ? share.conversions : null,
    convertingVisits: countConversions ? share.convertingVisits : null,
  };
}

function sum(counts: readonly Omit<ValueCount, 'value'>[]) {
  return counts.reduce(
    (total, count) => ({
      visits: total.visits + count.visits,
      conversions: total.conversions + count.conversions,
      convertingVisits: total.convertingVisits + count.convertingVisits,
    }),
    { visits: 0, conversions: 0, convertingVisits: 0 },
  );
}

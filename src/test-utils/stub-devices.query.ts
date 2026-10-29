import type {
  CityCount,
  DeviceDimension,
  DevicesQuery,
  ReachCounts,
  RegionCount,
  ValueCount,
} from '../domain/queries/devices';
import type { QueryScope } from '../domain/queries/query-scope';

export class StubDevicesQuery implements DevicesQuery {
  readonly asked: { readonly scope: QueryScope; readonly dimension: DeviceDimension }[] = [];
  readonly askedForRegions: QueryScope[] = [];
  readonly counts = new Map<DeviceDimension, readonly ValueCount[]>();
  regionCounts: readonly RegionCount[] = [];
  readonly askedForCities: QueryScope[] = [];
  cityCounts: readonly CityCount[] = [];
  readonly askedForReach: QueryScope[] = [];
  reachCounts: ReachCounts = { visits: 0, countries: [], regions: 0, cities: 0 };

  breakdown(scope: QueryScope, dimension: DeviceDimension): Promise<readonly ValueCount[]> {
    this.asked.push({ scope, dimension });
    return Promise.resolve(this.counts.get(dimension) ?? []);
  }

  regions(scope: QueryScope): Promise<readonly RegionCount[]> {
    this.askedForRegions.push(scope);
    return Promise.resolve(this.regionCounts);
  }

  cities(scope: QueryScope): Promise<readonly CityCount[]> {
    this.askedForCities.push(scope);
    return Promise.resolve(this.cityCounts);
  }

  reach(scope: QueryScope): Promise<ReachCounts> {
    this.askedForReach.push(scope);
    return Promise.resolve(this.reachCounts);
  }
}

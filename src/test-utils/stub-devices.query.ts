import type {
  DeviceDimension,
  DevicesQuery,
  RegionCount,
  ValueCount,
} from '../domain/queries/devices';
import type { QueryScope } from '../domain/queries/query-scope';

export class StubDevicesQuery implements DevicesQuery {
  readonly asked: { readonly scope: QueryScope; readonly dimension: DeviceDimension }[] = [];
  readonly askedForRegions: QueryScope[] = [];
  readonly counts = new Map<DeviceDimension, readonly ValueCount[]>();
  regionCounts: readonly RegionCount[] = [];

  breakdown(scope: QueryScope, dimension: DeviceDimension): Promise<readonly ValueCount[]> {
    this.asked.push({ scope, dimension });
    return Promise.resolve(this.counts.get(dimension) ?? []);
  }

  regions(scope: QueryScope): Promise<readonly RegionCount[]> {
    this.askedForRegions.push(scope);
    return Promise.resolve(this.regionCounts);
  }
}

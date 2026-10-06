import type { DeviceDimension, DevicesQuery, ValueCount } from '../domain/queries/devices';
import type { QueryScope } from '../domain/queries/query-scope';

export class StubDevicesQuery implements DevicesQuery {
  readonly asked: { readonly scope: QueryScope; readonly dimension: DeviceDimension }[] = [];
  readonly counts = new Map<DeviceDimension, readonly ValueCount[]>();

  breakdown(scope: QueryScope, dimension: DeviceDimension): Promise<readonly ValueCount[]> {
    this.asked.push({ scope, dimension });
    return Promise.resolve(this.counts.get(dimension) ?? []);
  }
}

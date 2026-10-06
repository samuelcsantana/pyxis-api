import type { AcquisitionQuery, ChannelDayCount, SourceCount } from '../domain/queries/acquisition';
import type { QueryScope } from '../domain/queries/query-scope';

export class StubAcquisitionQuery implements AcquisitionQuery {
  readonly scopes: QueryScope[] = [];
  readonly limits: number[] = [];
  byDay: readonly ChannelDayCount[] = [];
  bySource: readonly SourceCount[] = [];

  visitsByDayAndChannel(scope: QueryScope): Promise<readonly ChannelDayCount[]> {
    this.scopes.push(scope);
    return Promise.resolve(this.byDay);
  }

  sources(scope: QueryScope, limit: number): Promise<readonly SourceCount[]> {
    this.scopes.push(scope);
    this.limits.push(limit);
    return Promise.resolve(this.bySource);
  }
}

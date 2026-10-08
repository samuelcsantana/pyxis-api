import type {
  AcquisitionQuery,
  CampaignCount,
  ChannelDayCount,
  SourceCount,
} from '../domain/queries/acquisition';
import type { QueryScope } from '../domain/queries/query-scope';

export class StubAcquisitionQuery implements AcquisitionQuery {
  readonly scopes: QueryScope[] = [];
  readonly limits: number[] = [];
  byDay: readonly ChannelDayCount[] = [];
  bySource: readonly SourceCount[] = [];
  byCampaign: readonly CampaignCount[] = [];

  visitsByDayAndChannel(scope: QueryScope): Promise<readonly ChannelDayCount[]> {
    this.scopes.push(scope);
    return Promise.resolve(this.byDay);
  }

  sources(scope: QueryScope, limit: number): Promise<readonly SourceCount[]> {
    this.scopes.push(scope);
    this.limits.push(limit);
    return Promise.resolve(this.bySource);
  }

  campaigns(scope: QueryScope, limit: number): Promise<readonly CampaignCount[]> {
    this.scopes.push(scope);
    this.limits.push(limit);
    return Promise.resolve(this.byCampaign);
  }
}

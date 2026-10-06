import type { FunnelMode, FunnelQuery, FunnelStep } from '../domain/queries/funnel';
import type { QueryScope } from '../domain/queries/query-scope';

export class StubFunnelQuery implements FunnelQuery {
  readonly asked: {
    readonly scope: QueryScope;
    readonly mode: FunnelMode;
    readonly steps: readonly FunnelStep[];
  }[] = [];
  counts: readonly number[] = [];

  count(
    scope: QueryScope,
    mode: FunnelMode,
    steps: readonly FunnelStep[],
  ): Promise<readonly number[]> {
    this.asked.push({ scope, mode, steps });
    return Promise.resolve(this.counts);
  }
}

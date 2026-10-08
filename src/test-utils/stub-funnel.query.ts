import type { FunnelMode, FunnelQuery, FunnelReport, FunnelStep } from '../domain/queries/funnel';
import type { QueryScope } from '../domain/queries/query-scope';

export class StubFunnelQuery implements FunnelQuery {
  readonly asked: {
    readonly scope: QueryScope;
    readonly mode: FunnelMode;
    readonly steps: readonly FunnelStep[];
  }[] = [];
  report: FunnelReport = { steps: [], medianSecondsOverall: null };

  measure(
    scope: QueryScope,
    mode: FunnelMode,
    steps: readonly FunnelStep[],
  ): Promise<FunnelReport> {
    this.asked.push({ scope, mode, steps });
    return Promise.resolve(this.report);
  }
}

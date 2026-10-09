import type {
  FunnelMode,
  FunnelQuery,
  FunnelReport,
  FunnelSegment,
  FunnelSegmentDimension,
  FunnelStep,
  FunnelSubject,
  FunnelSubjectCursor,
  FunnelSubjectsAsked,
} from '../domain/queries/funnel';
import type { QueryScope } from '../domain/queries/query-scope';

export class StubFunnelQuery implements FunnelQuery {
  readonly asked: {
    readonly scope: QueryScope;
    readonly mode: FunnelMode;
    readonly steps: readonly FunnelStep[];
  }[] = [];
  report: FunnelReport = { steps: [], medianSecondsOverall: null };
  readonly subjectCalls: {
    readonly scope: QueryScope;
    readonly asked: FunnelSubjectsAsked;
    readonly after: FunnelSubjectCursor | null;
    readonly limit: number;
  }[] = [];
  found: readonly FunnelSubject[] = [];
  readonly segmentCalls: {
    readonly scope: QueryScope;
    readonly steps: readonly FunnelStep[];
    readonly by: FunnelSegmentDimension;
  }[] = [];
  segmented: readonly FunnelSegment[] = [];

  measure(
    scope: QueryScope,
    mode: FunnelMode,
    steps: readonly FunnelStep[],
  ): Promise<FunnelReport> {
    this.asked.push({ scope, mode, steps });
    return Promise.resolve(this.report);
  }

  subjects(
    scope: QueryScope,
    asked: FunnelSubjectsAsked,
    after: FunnelSubjectCursor | null,
    limit: number,
  ): Promise<readonly FunnelSubject[]> {
    this.subjectCalls.push({ scope, asked, after, limit });
    return Promise.resolve(this.found);
  }

  segments(
    scope: QueryScope,
    steps: readonly FunnelStep[],
    by: FunnelSegmentDimension,
  ): Promise<readonly FunnelSegment[]> {
    this.segmentCalls.push({ scope, steps, by });
    return Promise.resolve(this.segmented);
  }
}

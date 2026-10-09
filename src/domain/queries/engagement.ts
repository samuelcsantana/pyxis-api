import type { QueryScope } from './query-scope';

export const TOP_ENTRY_EXIT_PAGES = 10;
export const VISIT_LENGTH_BOUNDS_SECONDS: readonly number[] = [10, 30, 60, 180, 600, 1800];

export interface EntryPageCount {
  readonly path: string;
  readonly visits: number;
  readonly singlePageVisits: number;
}

export interface ExitPageCount {
  readonly path: string;
  readonly visits: number;
}

export interface VisitLengthCount {
  readonly bucket: number;
  readonly visits: number;
}

export interface VisitShapeTotals {
  readonly visits: number;
  readonly singlePageVisits: number;
  readonly medianVisitSeconds: number | null;
}

export interface EngagementQuery {
  entryPages(scope: QueryScope, limit: number): Promise<readonly EntryPageCount[]>;
  exitPages(scope: QueryScope, limit: number): Promise<readonly ExitPageCount[]>;
  totals(scope: QueryScope): Promise<VisitShapeTotals>;
  visitLengths(scope: QueryScope): Promise<readonly VisitLengthCount[]>;
}

export const ENGAGEMENT_QUERY = Symbol('EngagementQuery');

export interface VisitLengthBucket {
  readonly upToSeconds: number | null;
  readonly visits: number;
}

export interface EngagementReport extends VisitShapeTotals {
  readonly visitLengths: readonly VisitLengthBucket[];
  readonly entryPages: readonly EntryPageCount[];
  readonly exitPages: readonly ExitPageCount[];
}

export function visitLengthBuckets(
  counts: readonly VisitLengthCount[],
): readonly VisitLengthBucket[] {
  const visitsIn = new Map(counts.map((count) => [count.bucket, count.visits]));
  return [...VISIT_LENGTH_BOUNDS_SECONDS, null].map((upToSeconds, bucket) => ({
    upToSeconds,
    visits: visitsIn.get(bucket) ?? 0,
  }));
}

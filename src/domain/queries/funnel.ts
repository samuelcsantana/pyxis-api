import type { QueryScope } from './query-scope';

export const FUNNEL_MODES = ['visit', 'user'] as const;
export type FunnelMode = (typeof FUNNEL_MODES)[number];

export const MIN_FUNNEL_STEPS = 2;
export const MAX_FUNNEL_STEPS = 8;
export const FUNNEL_OUTCOMES = ['reached', 'dropped'] as const;
export type FunnelOutcome = (typeof FUNNEL_OUTCOMES)[number];
export const FUNNEL_SUBJECTS_PAGE_SIZE = 50;
export const FUNNEL_SEGMENT_DIMENSIONS = ['device', 'channel'] as const;
export type FunnelSegmentDimension = (typeof FUNNEL_SEGMENT_DIMENSIONS)[number];
export const UNKNOWN_SEGMENT = 'unknown';

export interface FunnelSegment {
  readonly segment: string;
  readonly counts: readonly number[];
}

export type FunnelStep =
  | { readonly type: 'page'; readonly path: string }
  | { readonly type: 'event'; readonly name: string };

export interface FunnelStepMeasure {
  readonly count: number;
  readonly medianSecondsFromPrevious: number | null;
}

export interface FunnelReport {
  readonly steps: readonly FunnelStepMeasure[];
  readonly medianSecondsOverall: number | null;
}

export interface FunnelSubjectsAsked {
  readonly mode: FunnelMode;
  readonly steps: readonly FunnelStep[];
  readonly stepIndex: number;
  readonly outcome: FunnelOutcome;
}

export interface FunnelSubjectCursor {
  readonly lastStepAt: Date;
  readonly id: string;
}

export interface FunnelSubject {
  readonly id: string;
  readonly lastStepAt: Date;
}

export interface FunnelQuery {
  measure(scope: QueryScope, mode: FunnelMode, steps: readonly FunnelStep[]): Promise<FunnelReport>;
  subjects(
    scope: QueryScope,
    asked: FunnelSubjectsAsked,
    after: FunnelSubjectCursor | null,
    limit: number,
  ): Promise<readonly FunnelSubject[]>;
  segments(
    scope: QueryScope,
    steps: readonly FunnelStep[],
    by: FunnelSegmentDimension,
  ): Promise<readonly FunnelSegment[]>;
}

export const FUNNEL_QUERY = Symbol('FunnelQuery');

export interface FunnelSubjectsReport {
  readonly subjects: readonly FunnelSubject[];
  readonly nextCursor: FunnelSubjectCursor | null;
}

export function funnelSubjectsPage(
  found: readonly FunnelSubject[],
  pageSize: number,
): FunnelSubjectsReport {
  const subjects = found.slice(0, pageSize);
  const [last] = found.length > pageSize ? subjects.slice(-1) : [];
  return { subjects, nextCursor: last === undefined ? null : { ...last } };
}

const LIKE_METACHARACTER = /[\\%_]/g;
const WILDCARD = /\*/g;

export function likePattern(path: string): string {
  return path.replace(LIKE_METACHARACTER, (character) => `\\${character}`).replace(WILDCARD, '%');
}

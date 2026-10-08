import type { QueryScope } from './query-scope';

export const FUNNEL_MODES = ['visit', 'user'] as const;
export type FunnelMode = (typeof FUNNEL_MODES)[number];

export const MIN_FUNNEL_STEPS = 2;
export const MAX_FUNNEL_STEPS = 8;

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

export interface FunnelQuery {
  measure(scope: QueryScope, mode: FunnelMode, steps: readonly FunnelStep[]): Promise<FunnelReport>;
}

export const FUNNEL_QUERY = Symbol('FunnelQuery');

const LIKE_METACHARACTER = /[\\%_]/g;
const WILDCARD = /\*/g;

export function likePattern(path: string): string {
  return path.replace(LIKE_METACHARACTER, (character) => `\\${character}`).replace(WILDCARD, '%');
}

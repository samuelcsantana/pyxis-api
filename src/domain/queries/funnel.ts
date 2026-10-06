import type { QueryScope } from './query-scope';

export const FUNNEL_MODES = ['visit', 'user'] as const;
export type FunnelMode = (typeof FUNNEL_MODES)[number];

export const MIN_FUNNEL_STEPS = 2;
export const MAX_FUNNEL_STEPS = 8;

export type FunnelStep =
  | { readonly type: 'page'; readonly path: string }
  | { readonly type: 'event'; readonly name: string };

export interface FunnelQuery {
  count(
    scope: QueryScope,
    mode: FunnelMode,
    steps: readonly FunnelStep[],
  ): Promise<readonly number[]>;
}

export const FUNNEL_QUERY = Symbol('FunnelQuery');

export interface FunnelReport {
  readonly steps: readonly { readonly count: number }[];
}

const LIKE_METACHARACTER = /[\\%_]/g;
const WILDCARD = /\*/g;

export function likePattern(path: string): string {
  return path.replace(LIKE_METACHARACTER, (character) => `\\${character}`).replace(WILDCARD, '%');
}

import type { Goal } from '../goals/goal';
import type { QueryScope } from './query-scope';

export interface GoalsSummaryCounts {
  readonly visits: number;
  readonly conversions: readonly number[];
  readonly convertingVisits: readonly number[];
}

export interface GoalsSummaryQuery {
  countsInGoalOrder(scope: QueryScope, goals: readonly Goal[]): Promise<GoalsSummaryCounts>;
}

export const GOALS_SUMMARY_QUERY = Symbol('GoalsSummaryQuery');

export interface GoalSummary {
  readonly goal: Goal;
  readonly conversions: number;
  readonly convertingVisits: number;
  readonly conversionRate: number | null;
}

export interface GoalsSummaryReport {
  readonly visits: number;
  readonly goals: readonly GoalSummary[];
}

export function conversionRate(convertingVisits: number, visits: number): number | null {
  return visits === 0 ? null : convertingVisits / visits;
}

export function goalsSummary(
  goals: readonly Goal[],
  counts: GoalsSummaryCounts,
): GoalsSummaryReport {
  return {
    visits: counts.visits,
    goals: goals.map((goal, index) => {
      const convertingVisits = counts.convertingVisits[index] ?? 0;
      return {
        goal,
        conversions: counts.conversions[index] ?? 0,
        convertingVisits,
        conversionRate: conversionRate(convertingVisits, counts.visits),
      };
    }),
  };
}

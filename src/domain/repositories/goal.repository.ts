import type { Goal, GoalChanges, GoalDraft } from '../goals/goal';

export type GoalCreation =
  { readonly outcome: 'created'; readonly goal: Goal } | { readonly outcome: 'limit_reached' };

export interface GoalRepository {
  listByProject(projectId: string): Promise<readonly Goal[]>;
  create(projectId: string, draft: GoalDraft, limit: number): Promise<GoalCreation>;
  update(projectId: string, goalId: string, changes: GoalChanges): Promise<Goal | null>;
  delete(projectId: string, goalId: string): Promise<boolean>;
}

export const GOAL_REPOSITORY = Symbol('GoalRepository');

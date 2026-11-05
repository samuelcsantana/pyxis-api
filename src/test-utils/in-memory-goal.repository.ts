import { type Goal, type GoalChanges, type GoalDraft, inGoalOrder } from '../domain/goals/goal';
import type { GoalCreation, GoalRepository } from '../domain/repositories/goal.repository';

const CREATED_AT = new Date('2026-11-04T12:00:00.000Z');
const ID_DIGITS = 12;

export function goalIdOf(sequence: number): string {
  return `00000000-0000-4000-8000-${String(sequence).padStart(ID_DIGITS, '0')}`;
}

export class InMemoryGoalRepository implements GoalRepository {
  private goals: readonly Goal[] = [];
  private sequence = 0;

  get stored(): readonly Goal[] {
    return this.goals;
  }

  add(...goals: readonly Goal[]): void {
    this.goals = [...this.goals, ...goals];
  }

  async listByProject(projectId: string): Promise<readonly Goal[]> {
    return Promise.resolve(inGoalOrder(this.goals.filter((goal) => goal.projectId === projectId)));
  }

  async create(projectId: string, draft: GoalDraft, limit: number): Promise<GoalCreation> {
    const held = await this.listByProject(projectId);
    if (held.length >= limit) {
      return { outcome: 'limit_reached' };
    }
    this.sequence += 1;
    const goal: Goal = {
      id: goalIdOf(this.sequence),
      projectId,
      name: draft.name,
      target: draft.target,
      position: Math.max(0, ...held.map(({ position }) => position)) + 1,
      createdAt: CREATED_AT,
    };
    this.add(goal);
    return { outcome: 'created', goal };
  }

  async update(projectId: string, goalId: string, changes: GoalChanges): Promise<Goal | null> {
    const found = this.goals.find((goal) => goal.id === goalId && goal.projectId === projectId);
    if (found === undefined) {
      return Promise.resolve(null);
    }
    const updated: Goal = {
      ...found,
      ...(changes.name === undefined ? {} : { name: changes.name }),
      ...(changes.target === undefined ? {} : { target: changes.target }),
    };
    this.goals = this.goals.map((goal) => (goal === found ? updated : goal));
    return Promise.resolve(updated);
  }

  async delete(projectId: string, goalId: string): Promise<boolean> {
    const before = this.goals.length;
    this.goals = this.goals.filter((goal) => goal.id !== goalId || goal.projectId !== projectId);
    return Promise.resolve(this.goals.length < before);
  }
}

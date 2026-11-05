import { GoalNotFoundError, InvalidGoalError } from '../errors/goal.errors';
import { EVENT_NAME_PATTERN, MAX_PATH_LENGTH } from '../events/event-limits';
import type { FunnelStep } from '../queries/funnel';

export const MAX_GOALS = 10;
export const MAX_GOAL_NAME_LENGTH = 64;
export const GOAL_KINDS = ['event', 'page'] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];

export type GoalTarget = FunnelStep;

export interface Goal {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly target: GoalTarget;
  readonly position: number;
  readonly createdAt: Date;
}

export interface GoalDraft {
  readonly name: string;
  readonly target: GoalTarget;
}

export interface GoalChanges {
  readonly name?: string;
  readonly target?: GoalTarget;
}

const PATH_START = '/';

export function requireGoalName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === '' || trimmed.length > MAX_GOAL_NAME_LENGTH) {
    throw new InvalidGoalError(
      'name',
      `The name must have 1 to ${String(MAX_GOAL_NAME_LENGTH)} characters.`,
    );
  }
  return trimmed;
}

export function requireGoalTarget(target: GoalTarget): GoalTarget {
  if (target.type === 'event') {
    if (!EVENT_NAME_PATTERN.test(target.name)) {
      throw new InvalidGoalError(
        'event',
        `"${target.name}" is not an event name: lower-case letters, digits and underscores, ` +
          'up to 64.',
      );
    }
    return { type: 'event', name: target.name };
  }
  if (!target.path.startsWith(PATH_START) || target.path.length > MAX_PATH_LENGTH) {
    throw new InvalidGoalError(
      'path',
      `A page pattern starts with / and has up to ${String(MAX_PATH_LENGTH)} characters; ` +
        'a star matches any characters.',
    );
  }
  return { type: 'page', path: target.path };
}

export function inGoalOrder(goals: readonly Goal[]): readonly Goal[] {
  return [...goals].sort((left, right) => left.position - right.position);
}

export function goalWithId(goals: readonly Goal[], goalId: string): Goal {
  const found = goals.find((goal) => goal.id === goalId);
  if (found === undefined) {
    throw new GoalNotFoundError();
  }
  return found;
}

export function conversionTarget(
  goals: readonly Goal[],
  goalId: string | undefined,
): GoalTarget | null {
  if (goalId !== undefined) {
    return goalWithId(goals, goalId).target;
  }
  const [first] = inGoalOrder(goals);
  return first?.target ?? null;
}

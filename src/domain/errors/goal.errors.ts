import { DomainError } from './domain.error';

export class InvalidGoalError extends DomainError {
  readonly code = 'invalid_goal';

  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
  }
}

export class GoalNotFoundError extends DomainError {
  readonly code = 'goal_not_found';

  constructor() {
    super('The project has no goal with this id.');
  }
}

export class GoalLimitReachedError extends DomainError {
  readonly code = 'goal_limit_reached';

  constructor(readonly limit: number) {
    super(`A project has at most ${String(limit)} goals: delete one before adding another.`);
  }
}

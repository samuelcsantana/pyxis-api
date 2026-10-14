import { DomainError } from './domain.error';

export class AccountNotFoundError extends DomainError {
  readonly code = 'account_not_found';

  constructor() {
    super('No account has this id.');
  }
}

export class ProjectLimitReachedError extends DomainError {
  readonly code = 'project_limit_reached';

  constructor(readonly limit: number) {
    super(`The account already has its ${String(limit)} projects: delete one to create another.`);
  }
}

import { DomainError } from './domain.error';

export class PeopleLimitReachedError extends DomainError {
  readonly code = 'people_limit_reached';

  constructor(limit: number) {
    super(
      `The account already has its ${String(limit)} people, its owner included: remove someone ` +
        'from its projects to add another.',
    );
  }
}

export class OwnerStaysError extends DomainError {
  readonly code = 'owner_stays';

  constructor() {
    super("The owner of the account keeps access to its projects; it can't be removed.");
  }
}

export class PersonNotFoundError extends DomainError {
  readonly code = 'person_not_found';

  constructor() {
    super('Nobody with this id or address reads this project.');
  }
}

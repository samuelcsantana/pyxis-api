import { DomainError } from './domain.error';

export class InvalidProjectSettingsError extends DomainError {
  readonly code = 'invalid_project_settings';

  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
  }
}

export class ProjectNotFoundError extends DomainError {
  readonly code = 'project_not_found';

  constructor() {
    super('No project has this id.');
  }
}

export class ProjectKeyNotFoundError extends DomainError {
  readonly code = 'key_not_found';

  constructor() {
    super('No live key has this id: it does not exist or is already revoked.');
  }
}

export class ProjectIconNotFoundError extends DomainError {
  readonly code = 'project_icon_not_found';

  constructor() {
    super('The project has no icon: its site shows none, or it was not fetched yet.');
  }
}

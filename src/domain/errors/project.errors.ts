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

export class ProjectNameMismatchError extends DomainError {
  readonly code = 'project_name_mismatch';

  constructor() {
    super("The name given does not match the project's name: nothing was deleted.");
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

export class LastPublicKeyError extends DomainError {
  readonly code = 'last_public_key';

  constructor() {
    super(
      "This is the project's only public key: create another and put it on the site before " +
        'revoking this one, or the site stops sending events.',
    );
  }
}

export class KeyLimitReachedError extends DomainError {
  readonly code = 'key_limit_reached';

  constructor(limit: number) {
    super(`The project already has ${String(limit)} live keys of this kind: revoke one first.`);
  }
}

export class ProjectSuspendedError extends DomainError {
  readonly code = 'project_suspended';

  constructor(readonly allowedOrigin: string | null) {
    super(
      "The project's event reception is suspended: its owner was told why by e-mail and can " +
        'contest it.',
    );
  }
}

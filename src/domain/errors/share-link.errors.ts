import { DomainError } from './domain.error';

export class InvalidShareLinkError extends DomainError {
  readonly code = 'invalid_share_link';

  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
  }
}

export class ShareLinkNotFoundError extends DomainError {
  readonly code = 'share_link_not_found';

  constructor() {
    super('No open share link has this token or id.');
  }
}

export class ShareLinkLimitReachedError extends DomainError {
  readonly code = 'share_link_limit_reached';

  constructor(readonly limit: number) {
    super(`A project has at most ${String(limit)} share links: revoke one before adding another.`);
  }
}

export class SharePasswordRequiredError extends DomainError {
  readonly code = 'share_password_required';

  constructor() {
    super('This link has a password: unlock it first and send the answer as a bearer.');
  }
}

export class WrongSharePasswordError extends DomainError {
  readonly code = 'wrong_share_password';

  constructor() {
    super('The password does not open this link.');
  }
}

export class SharePasswordNotSetError extends DomainError {
  readonly code = 'share_password_not_set';

  constructor() {
    super('This link has no password to unlock.');
  }
}

export class ShareLinkLockedError extends DomainError {
  readonly code = 'rate_limited';

  constructor(readonly retryAfterSeconds: number) {
    super('Too many wrong passwords for this link; retry later.');
  }
}

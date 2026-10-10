import { DomainError } from './domain.error';

export class InvalidSignInCodeError extends DomainError {
  readonly code = 'invalid_code';

  constructor() {
    super('The code is wrong, expired or already used. Ask for a new one.');
  }
}

export class UnauthenticatedError extends DomainError {
  readonly code = 'unauthenticated';

  constructor() {
    super('Sign in to continue.');
  }
}

export class SessionNotFoundError extends DomainError {
  readonly code = 'session_not_found';

  constructor() {
    super('The session does not exist, is not yours, or has already ended.');
  }
}

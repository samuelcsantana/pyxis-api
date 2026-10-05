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

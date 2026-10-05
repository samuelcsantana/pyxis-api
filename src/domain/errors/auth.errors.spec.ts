import { InvalidSignInCodeError, UnauthenticatedError } from './auth.errors';
import { DomainError } from './domain.error';

describe('auth errors', () => {
  it.each([
    [new InvalidSignInCodeError(), 'invalid_code'],
    [new UnauthenticatedError(), 'unauthenticated'],
  ])('%s carries a stable machine code', (error, code) => {
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe(code);
  });
});

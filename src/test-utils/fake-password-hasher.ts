import type { PasswordHasher } from '../domain/services/password-hasher';

const FAKE_PREFIX = 'fake-hash:';

export class FakePasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return Promise.resolve(`${FAKE_PREFIX}${password}`);
  }

  verify(password: string, stored: string): Promise<boolean> {
    return Promise.resolve(stored === `${FAKE_PREFIX}${password}`);
  }
}

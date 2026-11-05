import { SequenceRandomSource } from '../../test-utils/sequence-random-source';
import {
  CURRENT_SCRYPT_PARAMETERS,
  SCRYPT_KEY_LENGTH,
  SCRYPT_SALT_LENGTH,
  ScryptPasswordHasher,
} from './scrypt-password-hasher';

const SALT_BYTES = Array.from({ length: 64 }, (_, index) => index);
const LIGHTER = { cost: 1024, blockSize: 8, parallelism: 1 };

function hasher(parameters = CURRENT_SCRYPT_PARAMETERS) {
  return new ScryptPasswordHasher(new SequenceRandomSource(SALT_BYTES), parameters);
}

describe('ScryptPasswordHasher', () => {
  it('stores the scheme, its parameters, a 16-byte salt and a 32-byte key', async () => {
    const stored = await new ScryptPasswordHasher(new SequenceRandomSource(SALT_BYTES)).hash(
      'correct horse',
    );
    const [scheme, cost, blockSize, parallelism, salt, key] = stored.split('$');

    expect([scheme, cost, blockSize, parallelism]).toEqual(['scrypt', '16384', '8', '1']);
    expect(Buffer.from(salt ?? '', 'base64')).toHaveLength(SCRYPT_SALT_LENGTH);
    expect(Buffer.from(key ?? '', 'base64')).toHaveLength(SCRYPT_KEY_LENGTH);
    expect(stored).not.toContain('correct horse');
  });

  it('verifies the right password and refuses another, even one character off', async () => {
    const stored = await hasher().hash('correct horse');

    await expect(hasher().verify('correct horse', stored)).resolves.toBe(true);
    await expect(hasher().verify('correct horsE', stored)).resolves.toBe(false);
    await expect(hasher().verify('correct horse ', stored)).resolves.toBe(false);
  });

  it('salts each hash, so one password never stores the same twice', async () => {
    const source = hasher();

    expect(await source.hash('correct horse')).not.toBe(await source.hash('correct horse'));
  });

  it('verifies a hash made with other parameters by the ones stored with it', async () => {
    const stored = await hasher(LIGHTER).hash('correct horse');

    expect(stored.startsWith('scrypt$1024$8$1$')).toBe(true);
    await expect(hasher().verify('correct horse', stored)).resolves.toBe(true);
  });

  it.each([
    ['another scheme', 'bcrypt$16384$8$1$c2FsdA==$a2V5'],
    ['too few fields', 'scrypt$16384$8$1$c2FsdA=='],
    ['a cost that is not a number', 'scrypt$lots$8$1$c2FsdA==$a2V5'],
    ['a block size of zero', 'scrypt$16384$0$1$c2FsdA==$a2V5'],
    ['a parallelism with a sign', 'scrypt$16384$8$+1$c2FsdA==$a2V5'],
    ['an empty key', 'scrypt$16384$8$1$c2FsdA==$'],
    ['nothing at all', ''],
  ])('refuses a stored hash with %s, without throwing', async (_case, stored) => {
    await expect(hasher().verify('correct horse', stored)).resolves.toBe(false);
  });

  it('passes on a failure of scrypt itself', async () => {
    await expect(
      hasher({ cost: 1000, blockSize: 8, parallelism: 1 }).hash('correct horse'),
    ).rejects.toThrow();
  });
});

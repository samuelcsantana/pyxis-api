import { createHash } from 'node:crypto';
import { SequenceRandomSource } from '../../test-utils/sequence-random-source';
import {
  generatePublicKey,
  generateSecretKey,
  hashSecretKey,
  PUBLIC_KEY_PATTERN,
  PUBLIC_KEY_PREFIX,
  SECRET_KEY_PATTERN,
  SECRET_KEY_PREFIX,
} from './project-keys';

const COUNTING_BYTES = Array.from({ length: 62 }, (_, index) => index);
const COUNTED_BODY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef';

describe('generatePublicKey', () => {
  it('builds pyxis_pk_ plus 32 characters from the random source', () => {
    const key = generatePublicKey(new SequenceRandomSource(COUNTING_BYTES));

    expect(key).toBe(`${PUBLIC_KEY_PREFIX}${COUNTED_BODY}`);
    expect(key).toMatch(PUBLIC_KEY_PATTERN);
  });

  it('maps the bytes onto upper-case letters, lower-case letters and digits, modulo 62', () => {
    const key = generatePublicKey(new SequenceRandomSource([25, 26, 52, 113]));

    expect(key).toBe(`${PUBLIC_KEY_PREFIX}${'Za0z'.repeat(8)}`);
  });

  it('skips the bytes that would bias the alphabet and asks for more', () => {
    const random = new SequenceRandomSource([248, 255, 0]);
    const bytesSpy = jest.spyOn(random, 'bytes');

    const key = generatePublicKey(random);

    expect(key).toBe(`${PUBLIC_KEY_PREFIX}${'A'.repeat(32)}`);
    expect(bytesSpy.mock.calls.length).toBeGreaterThan(1);
  });
});

describe('key formats', () => {
  it('uses prefixes no other service issues, so scanners can name a leaked key', () => {
    expect(PUBLIC_KEY_PREFIX).toBe('pyxis_pk_');
    expect(SECRET_KEY_PREFIX).toBe('pyxis_sk_');
  });

  it.each([
    ['a Stripe-shaped public key', `pk_live_${'A'.repeat(32)}`],
    ['a body one character short', `${PUBLIC_KEY_PREFIX}${'A'.repeat(31)}`],
    ['a body with a symbol', `${PUBLIC_KEY_PREFIX}${'A'.repeat(31)}-`],
  ])('rejects %s as a public key', (_, key) => {
    expect(PUBLIC_KEY_PATTERN.test(key)).toBe(false);
  });

  it('does not accept a secret key where a public key is expected', () => {
    expect(PUBLIC_KEY_PATTERN.test(`${SECRET_KEY_PREFIX}${'A'.repeat(32)}`)).toBe(false);
  });
});

describe('generateSecretKey', () => {
  it('builds pyxis_sk_ plus 32 characters from the random source', () => {
    const key = generateSecretKey(new SequenceRandomSource(COUNTING_BYTES));

    expect(key).toBe(`${SECRET_KEY_PREFIX}${COUNTED_BODY}`);
    expect(key).toMatch(SECRET_KEY_PATTERN);
  });
});

describe('hashSecretKey', () => {
  it('is the SHA-256 of the key in lower-case hex', () => {
    const key = `${SECRET_KEY_PREFIX}${'a'.repeat(32)}`;

    expect(hashSecretKey(key)).toBe(createHash('sha256').update(key).digest('hex'));
    expect(hashSecretKey(key)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives different keys different hashes', () => {
    expect(hashSecretKey(`${SECRET_KEY_PREFIX}${'a'.repeat(32)}`)).not.toBe(
      hashSecretKey(`${SECRET_KEY_PREFIX}${'b'.repeat(32)}`),
    );
  });
});

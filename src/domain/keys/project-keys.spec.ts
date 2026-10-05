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
  it('builds pk_live_ plus 32 characters from the random source', () => {
    const key = generatePublicKey(new SequenceRandomSource(COUNTING_BYTES));

    expect(key).toBe(`${PUBLIC_KEY_PREFIX}${COUNTED_BODY}`);
    expect(key).toMatch(PUBLIC_KEY_PATTERN);
  });

  it('maps the bytes onto upper-case letters, lower-case letters and digits, modulo 62', () => {
    const key = generatePublicKey(new SequenceRandomSource([25, 26, 52, 113]));

    expect(key).toBe(`pk_live_${'Za0z'.repeat(8)}`);
  });

  it('skips the bytes that would bias the alphabet and asks for more', () => {
    const random = new SequenceRandomSource([248, 255, 0]);
    const bytesSpy = jest.spyOn(random, 'bytes');

    const key = generatePublicKey(random);

    expect(key).toBe(`pk_live_${'A'.repeat(32)}`);
    expect(bytesSpy.mock.calls.length).toBeGreaterThan(1);
  });
});

describe('generateSecretKey', () => {
  it('builds sk_live_ plus 32 characters from the random source', () => {
    const key = generateSecretKey(new SequenceRandomSource(COUNTING_BYTES));

    expect(key).toBe(`${SECRET_KEY_PREFIX}${COUNTED_BODY}`);
    expect(key).toMatch(SECRET_KEY_PATTERN);
  });
});

describe('hashSecretKey', () => {
  it('is the SHA-256 of the key in lower-case hex', () => {
    const key = `sk_live_${'a'.repeat(32)}`;

    expect(hashSecretKey(key)).toBe(createHash('sha256').update(key).digest('hex'));
    expect(hashSecretKey(key)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives different keys different hashes', () => {
    expect(hashSecretKey(`sk_live_${'a'.repeat(32)}`)).not.toBe(
      hashSecretKey(`sk_live_${'b'.repeat(32)}`),
    );
  });
});

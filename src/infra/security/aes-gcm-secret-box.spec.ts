import { Logger } from '@nestjs/common';
import { SlackUnavailableError } from '../../domain/errors/slack.errors';
import { CryptoRandomSource } from '../random/crypto-random-source';
import {
  AesGcmSecretBox,
  createSecretBox,
  InvalidSecretBoxKeysError,
  parseSecretBoxKeys,
  SECRET_BOX_IV_LENGTH,
  UnconfiguredSecretBox,
} from './aes-gcm-secret-box';

const KEY_ONE = Buffer.alloc(32, 1).toString('base64');
const KEY_TWO = Buffer.alloc(32, 2).toString('base64');
const SECRET = 'https://hooks.slack.com/services/T0001/B0002/abcdefghijklmnop';
const CONTEXT = 'slack-webhook:project-1';
const random = new CryptoRandomSource();

function boxWith(keys: string): AesGcmSecretBox {
  return new AesGcmSecretBox(parseSecretBoxKeys(keys), random);
}

function partsOf(sealed: string): string[] {
  return sealed.split('.');
}

describe('parseSecretBoxKeys', () => {
  it('reads each version and its 32-byte key', () => {
    const keys = parseSecretBoxKeys(` 1:${KEY_ONE} , 2:${KEY_TWO}`);

    expect([...keys.keys()]).toEqual([1, 2]);
    expect(keys.get(2)).toEqual(Buffer.alloc(32, 2));
  });

  it.each([
    ['no version', KEY_ONE],
    ['a version that is not a positive integer', `0:${KEY_ONE}`],
    ['a short key', `1:${Buffer.alloc(16, 1).toString('base64')}`],
    ['a repeated version', `1:${KEY_ONE},1:${KEY_TWO}`],
    ['the placeholder Terraform writes', 'placeholder-set-in-the-console'],
  ])('refuses %s', (_label, keys) => {
    expect(() => parseSecretBoxKeys(keys)).toThrow(InvalidSecretBoxKeysError);
  });
});

describe('AesGcmSecretBox', () => {
  it('opens what it sealed, with a fresh 12-byte IV every time', () => {
    const box = boxWith(`1:${KEY_ONE}`);

    const first = box.seal(SECRET, CONTEXT);
    const second = box.seal(SECRET, CONTEXT);

    expect(box.open(first, CONTEXT)).toBe(SECRET);
    expect(first).not.toBe(second);
    expect(partsOf(first)[0]).toBe('v1');
    expect(Buffer.from(partsOf(first)[1] ?? '', 'base64url')).toHaveLength(SECRET_BOX_IV_LENGTH);
    expect(first).not.toContain('hooks');
  });

  it('seals with the newest key and still opens what an older key sealed', () => {
    const before = boxWith(`1:${KEY_ONE}`).seal(SECRET, CONTEXT);
    const rotated = boxWith(`1:${KEY_ONE},2:${KEY_TWO}`);

    expect(partsOf(rotated.seal(SECRET, CONTEXT))[0]).toBe('v2');
    expect(rotated.open(before, CONTEXT)).toBe(SECRET);
  });

  it('refuses a value sealed for another project', () => {
    const box = boxWith(`1:${KEY_ONE}`);

    expect(() => box.open(box.seal(SECRET, CONTEXT), 'slack-webhook:project-2')).toThrow(
      SlackUnavailableError,
    );
  });

  it('refuses a value whose ciphertext was changed', () => {
    const box = boxWith(`1:${KEY_ONE}`);
    const [version, iv, tag, encrypted = ''] = partsOf(box.seal(SECRET, CONTEXT));
    const flipped = Buffer.from(encrypted, 'base64url');
    flipped[0] = (flipped[0] ?? 0) ^ 1;

    expect(() =>
      box.open([version, iv, tag, flipped.toString('base64url')].join('.'), CONTEXT),
    ).toThrow(SlackUnavailableError);
  });

  it('refuses a value sealed with a key it no longer has', () => {
    const sealed = boxWith(`2:${KEY_TWO}`).seal(SECRET, CONTEXT);

    expect(() => boxWith(`1:${KEY_ONE}`).open(sealed, CONTEXT)).toThrow(SlackUnavailableError);
  });

  it.each(['', 'v1.a.b', 'x1.a.b.c', 'v0.a.b.c', 'v1.a.b.c.d'])(
    'refuses the malformed %p',
    (sealed) => {
      expect(() => boxWith(`1:${KEY_ONE}`).open(sealed, CONTEXT)).toThrow(SlackUnavailableError);
    },
  );
});

describe('createSecretBox', () => {
  it('answers a box that refuses everything when no key is configured', () => {
    const box = createSecretBox(undefined, random);

    expect(box).toBeInstanceOf(UnconfiguredSecretBox);
    expect(() => box.seal(SECRET, CONTEXT)).toThrow(SlackUnavailableError);
    expect(() => box.open('v1.a.b.c', CONTEXT)).toThrow(SlackUnavailableError);
  });

  it('keeps the server up, logging only that the keys are invalid, never their text', () => {
    const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    expect(createSecretBox('placeholder-set-in-the-console', random)).toBeInstanceOf(
      UnconfiguredSecretBox,
    );
    expect(errors).toHaveBeenCalledWith({ message: 'secret_box.keys_invalid' });
    errors.mockRestore();
  });

  it('answers the AES-GCM box when keys are configured', () => {
    const box = createSecretBox(`1:${KEY_ONE}`, random);

    expect(box.open(box.seal(SECRET, CONTEXT), CONTEXT)).toBe(SECRET);
  });
});

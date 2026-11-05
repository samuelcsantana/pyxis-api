import { Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv } from 'node:crypto';
import { SlackUnavailableError } from '../../domain/errors/slack.errors';
import type { RandomSource } from '../../domain/services/random-source';
import type { SecretBox } from '../../domain/services/secret-box';

export const SECRET_BOX_CIPHER = 'aes-256-gcm';
export const SECRET_BOX_KEY_LENGTH = 32;
export const SECRET_BOX_IV_LENGTH = 12;
export const SECRET_BOX_TAG_LENGTH = 16;

const KEY_SEPARATOR = ',';
const VERSION_SEPARATOR = ':';
const PART_SEPARATOR = '.';
const VERSION_PREFIX = 'v';
const SEALED_PARTS = 4;
const KEY_ENCODING = 'base64';
const SEALED_ENCODING = 'base64url';
const POSITIVE_INTEGER = /^[1-9]\d{0,5}$/;

export type SecretBoxKeys = ReadonlyMap<number, Buffer>;

export class InvalidSecretBoxKeysError extends Error {
  constructor() {
    super('The secret box keys must read version:base64-key[,version:base64-key], 32-byte keys.');
    this.name = 'InvalidSecretBoxKeysError';
  }
}

function keyEntry(entry: string): readonly [number, Buffer] {
  const separator = entry.indexOf(VERSION_SEPARATOR);
  const version = entry.slice(0, separator).trim();
  const key = Buffer.from(entry.slice(separator + 1).trim(), KEY_ENCODING);
  if (separator < 0 || !POSITIVE_INTEGER.test(version) || key.length !== SECRET_BOX_KEY_LENGTH) {
    throw new InvalidSecretBoxKeysError();
  }
  return [Number(version), key];
}

export function parseSecretBoxKeys(text: string): SecretBoxKeys {
  const entries = text.split(KEY_SEPARATOR).map(keyEntry);
  const keys = new Map(entries);
  if (keys.size !== entries.length) {
    throw new InvalidSecretBoxKeysError();
  }
  return keys;
}

export class AesGcmSecretBox implements SecretBox {
  private readonly currentVersion: number;

  constructor(
    private readonly keys: SecretBoxKeys,
    private readonly random: RandomSource,
  ) {
    this.currentVersion = Math.max(...keys.keys());
  }

  seal(plain: string, context: string): string {
    const key = this.keyOf(this.currentVersion);
    const iv = Buffer.from(this.random.bytes(SECRET_BOX_IV_LENGTH));
    const cipher = createCipheriv(SECRET_BOX_CIPHER, key, iv, {
      authTagLength: SECRET_BOX_TAG_LENGTH,
    });
    cipher.setAAD(Buffer.from(context));
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [
      `${VERSION_PREFIX}${String(this.currentVersion)}`,
      iv.toString(SEALED_ENCODING),
      cipher.getAuthTag().toString(SEALED_ENCODING),
      encrypted.toString(SEALED_ENCODING),
    ].join(PART_SEPARATOR);
  }

  open(sealed: string, context: string): string {
    const parts = sealed.split(PART_SEPARATOR);
    const [version, iv, tag, encrypted] = parts;
    const versionNumber = version?.startsWith(VERSION_PREFIX) ? version.slice(1) : '';
    if (
      parts.length !== SEALED_PARTS ||
      !POSITIVE_INTEGER.test(versionNumber) ||
      iv === undefined ||
      tag === undefined ||
      encrypted === undefined
    ) {
      throw new SlackUnavailableError();
    }
    const key = this.keyOf(Number(versionNumber));
    try {
      const decipher = createDecipheriv(SECRET_BOX_CIPHER, key, Buffer.from(iv, SEALED_ENCODING), {
        authTagLength: SECRET_BOX_TAG_LENGTH,
      });
      decipher.setAAD(Buffer.from(context));
      decipher.setAuthTag(Buffer.from(tag, SEALED_ENCODING));
      return Buffer.concat([
        decipher.update(Buffer.from(encrypted, SEALED_ENCODING)),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new SlackUnavailableError();
    }
  }

  private keyOf(version: number): Buffer {
    const key = this.keys.get(version);
    if (key === undefined) {
      throw new SlackUnavailableError();
    }
    return key;
  }
}

export class UnconfiguredSecretBox implements SecretBox {
  seal(): string {
    throw new SlackUnavailableError();
  }

  open(): string {
    throw new SlackUnavailableError();
  }
}

const logger = new Logger('SecretBox');

export function createSecretBox(keysText: string | undefined, random: RandomSource): SecretBox {
  if (keysText === undefined) {
    return new UnconfiguredSecretBox();
  }
  try {
    return new AesGcmSecretBox(parseSecretBoxKeys(keysText), random);
  } catch {
    logger.error({ message: 'secret_box.keys_invalid' });
    return new UnconfiguredSecretBox();
  }
}

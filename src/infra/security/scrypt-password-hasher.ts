import { type ScryptOptions, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { PasswordHasher } from '../../domain/services/password-hasher';
import type { RandomSource } from '../../domain/services/random-source';

export const SCRYPT_SCHEME = 'scrypt';
export const SCRYPT_COST = 16384;
export const SCRYPT_BLOCK_SIZE = 8;
export const SCRYPT_PARALLELISM = 1;
export const SCRYPT_KEY_LENGTH = 32;
export const SCRYPT_SALT_LENGTH = 16;

const FIELD_SEPARATOR = '$';
const FIELD_COUNT = 6;
const MEMORY_PER_COST_AND_BLOCK = 128;
const MEMORY_HEADROOM = 2;
const POSITIVE_INTEGER = /^[1-9]\d{0,9}$/;
const ENCODING = 'base64';

const scryptWithOptions = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
) => Promise<Buffer>;

export interface ScryptParameters {
  readonly cost: number;
  readonly blockSize: number;
  readonly parallelism: number;
}

export const CURRENT_SCRYPT_PARAMETERS: ScryptParameters = {
  cost: SCRYPT_COST,
  blockSize: SCRYPT_BLOCK_SIZE,
  parallelism: SCRYPT_PARALLELISM,
};

interface StoredHash extends ScryptParameters {
  readonly salt: Buffer;
  readonly key: Buffer;
}

function derive(
  password: string,
  salt: Buffer,
  keyLength: number,
  parameters: ScryptParameters,
): Promise<Buffer> {
  const options: ScryptOptions = {
    N: parameters.cost,
    r: parameters.blockSize,
    p: parameters.parallelism,
    maxmem: MEMORY_HEADROOM * MEMORY_PER_COST_AND_BLOCK * parameters.cost * parameters.blockSize,
  };
  return scryptWithOptions(password, salt, keyLength, options);
}

function integerOf(field: string | undefined): number | null {
  return field !== undefined && POSITIVE_INTEGER.test(field) ? Number(field) : null;
}

function parse(stored: string): StoredHash | null {
  const fields = stored.split(FIELD_SEPARATOR);
  const [scheme, cost, blockSize, parallelism, salt, key] = fields;
  const parameters = {
    cost: integerOf(cost),
    blockSize: integerOf(blockSize),
    parallelism: integerOf(parallelism),
  };
  if (
    fields.length !== FIELD_COUNT ||
    scheme !== SCRYPT_SCHEME ||
    parameters.cost === null ||
    parameters.blockSize === null ||
    parameters.parallelism === null ||
    salt === undefined ||
    key === undefined
  ) {
    return null;
  }
  return {
    cost: parameters.cost,
    blockSize: parameters.blockSize,
    parallelism: parameters.parallelism,
    salt: Buffer.from(salt, ENCODING),
    key: Buffer.from(key, ENCODING),
  };
}

export class ScryptPasswordHasher implements PasswordHasher {
  constructor(
    private readonly random: RandomSource,
    private readonly parameters: ScryptParameters = CURRENT_SCRYPT_PARAMETERS,
  ) {}

  async hash(password: string): Promise<string> {
    const salt = Buffer.from(this.random.bytes(SCRYPT_SALT_LENGTH));
    const key = await derive(password, salt, SCRYPT_KEY_LENGTH, this.parameters);
    return [
      SCRYPT_SCHEME,
      String(this.parameters.cost),
      String(this.parameters.blockSize),
      String(this.parameters.parallelism),
      salt.toString(ENCODING),
      key.toString(ENCODING),
    ].join(FIELD_SEPARATOR);
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const parsed = parse(stored);
    if (parsed === null || parsed.key.length === 0) {
      return false;
    }
    const key = await derive(password, parsed.salt, parsed.key.length, parsed);
    return timingSafeEqual(key, parsed.key);
  }
}

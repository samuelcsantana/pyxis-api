import { createHash } from 'node:crypto';
import type { RandomSource } from '../services/random-source';

export const PUBLIC_KEY_PREFIX = 'pyxis_pk_';
export const SECRET_KEY_PREFIX = 'pyxis_sk_';
export const KEY_BODY_LENGTH = 32;
export const PUBLIC_KEY_PATTERN = /^pyxis_pk_[A-Za-z0-9]{32}$/;
export const SECRET_KEY_PATTERN = /^pyxis_sk_[A-Za-z0-9]{32}$/;

const KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const UNBIASED_BYTE_LIMIT = Math.floor(256 / KEY_ALPHABET.length) * KEY_ALPHABET.length;

function randomKeyBody(random: RandomSource): string {
  let body = '';
  while (body.length < KEY_BODY_LENGTH) {
    const usable = Array.from(random.bytes(KEY_BODY_LENGTH)).filter(
      (byte) => byte < UNBIASED_BYTE_LIMIT,
    );
    body += usable.map((byte) => KEY_ALPHABET.charAt(byte % KEY_ALPHABET.length)).join('');
  }
  return body.slice(0, KEY_BODY_LENGTH);
}

export function generatePublicKey(random: RandomSource): string {
  return `${PUBLIC_KEY_PREFIX}${randomKeyBody(random)}`;
}

export function generateSecretKey(random: RandomSource): string {
  return `${SECRET_KEY_PREFIX}${randomKeyBody(random)}`;
}

export function hashSecretKey(secretKey: string): string {
  return createHash('sha256').update(secretKey).digest('hex');
}

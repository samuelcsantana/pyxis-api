import type { RandomSource } from '../services/random-source';

export const SIGN_IN_CODE_LENGTH = 6;
export const SIGN_IN_CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_SIGN_IN_CODE_ATTEMPTS = 5;
export const MAX_SIGN_IN_CODES_PER_WINDOW = 5;
export const SIGN_IN_CODE_WINDOW_MS = 60 * 60 * 1000;

const DIGITS = 10;
const UNBIASED_BYTE_LIMIT = Math.floor(256 / DIGITS) * DIGITS;

export function generateSignInCode(random: RandomSource): string {
  let code = '';
  while (code.length < SIGN_IN_CODE_LENGTH) {
    const digits = Array.from(random.bytes(SIGN_IN_CODE_LENGTH))
      .filter((byte) => byte < UNBIASED_BYTE_LIMIT)
      .map((byte) => String(byte % DIGITS));
    code += digits.join('');
  }
  return code.slice(0, SIGN_IN_CODE_LENGTH);
}

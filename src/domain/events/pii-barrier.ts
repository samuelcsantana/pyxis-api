import { countDigits, isUuid } from './text-shapes';

export type PiiReason = 'email' | 'long_number';

const EMAIL_SHAPE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const DIGITS_AND_SEPARATORS = /^[\d.\-/()+ ]+$/;
const MIN_PERSONAL_DIGITS = 10;
const SMALLEST_PERSONAL_INTEGER = 10 ** (MIN_PERSONAL_DIGITS - 1);

function textLooksPersonal(text: string): PiiReason | null {
  if (isUuid(text)) {
    return null;
  }
  if (DIGITS_AND_SEPARATORS.test(text) && countDigits(text) >= MIN_PERSONAL_DIGITS) {
    return 'long_number';
  }
  if (EMAIL_SHAPE.test(text)) {
    return 'email';
  }
  return null;
}

export function looksPersonal(value: string | number): PiiReason | null {
  if (typeof value === 'string') {
    return textLooksPersonal(value);
  }
  return Math.abs(Math.trunc(value)) >= SMALLEST_PERSONAL_INTEGER ? 'long_number' : null;
}

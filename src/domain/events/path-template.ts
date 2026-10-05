import { countDigits, isUuid } from './text-shapes';

export const ID_PLACEHOLDER = ':id';

const ALL_DIGITS = /^\d+$/;
const ENCODED_AT_SIGN = /%40/i;
const TRAILING_SLASHES = /\/+$/;
const MIN_ID_DIGITS = 10;

function isIdentifier(segment: string): boolean {
  return (
    isUuid(segment) ||
    ALL_DIGITS.test(segment) ||
    countDigits(segment) >= MIN_ID_DIGITS ||
    segment.includes('@') ||
    ENCODED_AT_SIGN.test(segment)
  );
}

export function templatePath(path: string): string {
  const templated = path
    .split('/')
    .map((segment) => (isIdentifier(segment) ? ID_PLACEHOLDER : segment))
    .join('/')
    .replace(TRAILING_SLASHES, '');
  return templated === '' ? '/' : templated;
}

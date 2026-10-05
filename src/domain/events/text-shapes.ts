const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGIT_PATTERN = /\d/g;

export function isUuid(text: string): boolean {
  return UUID_PATTERN.test(text);
}

export function countDigits(text: string): number {
  return text.match(DIGIT_PATTERN)?.length ?? 0;
}

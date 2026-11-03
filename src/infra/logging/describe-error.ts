import { DrizzleQueryError } from 'drizzle-orm';

const ERROR_CODE = /^[0-9A-Z_]{1,40}$/;
const NO_CODE = 'no code';

function codeOf(cause: unknown): string {
  if (typeof cause !== 'object' || cause === null || !('code' in cause)) {
    return NO_CODE;
  }
  const { code } = cause;
  return typeof code === 'string' && ERROR_CODE.test(code) ? code : NO_CODE;
}

export function describeError(error: unknown): string {
  if (error instanceof DrizzleQueryError) {
    return `database query failed (${codeOf(error.cause)})`;
  }
  return error instanceof Error ? error.message : String(error);
}

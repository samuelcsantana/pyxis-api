import { InvalidShareLinkError } from '../errors/share-link.errors';
import { bearerCredential, randomKeyBody } from '../keys/project-keys';
import type { RandomSource } from '../services/random-source';

export const MIN_SHARE_PASSWORD_LENGTH = 8;
export const MAX_SHARE_PASSWORD_LENGTH = 128;
export const MAX_SHARE_PASSWORD_INPUT_UNITS = 4 * MAX_SHARE_PASSWORD_LENGTH;
export const SHARE_UNLOCK_PREFIX = 'pyxis_su_';
export const SHARE_UNLOCK_PATTERN = /^pyxis_su_[A-Za-z0-9]{32}$/;
export const SHARE_UNLOCK_LIFETIME_MS = 8 * 60 * 60 * 1000;
export const MAX_FAILED_UNLOCKS = 50;
export const UNLOCK_FAILURE_WINDOW_MS = 15 * 60 * 1000;

const MILLISECONDS_PER_SECOND = 1000;

export interface UnlockFailures {
  readonly count: number;
  readonly since: Date | null;
}

export function requireSharePassword(password: string): string {
  const length = Array.from(password).length;
  if (length < MIN_SHARE_PASSWORD_LENGTH || length > MAX_SHARE_PASSWORD_LENGTH) {
    throw new InvalidShareLinkError(
      'password',
      `A link password has ${String(MIN_SHARE_PASSWORD_LENGTH)} to ` +
        `${String(MAX_SHARE_PASSWORD_LENGTH)} characters.`,
    );
  }
  return password;
}

export function generateShareUnlock(random: RandomSource): string {
  return `${SHARE_UNLOCK_PREFIX}${randomKeyBody(random)}`;
}

export function shareUnlockFromAuthorization(header: string | undefined): string | null {
  const candidate = bearerCredential(header);
  return candidate !== null && SHARE_UNLOCK_PATTERN.test(candidate) ? candidate : null;
}

export function shareUnlockExpiry(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + SHARE_UNLOCK_LIFETIME_MS);
}

function windowEnd(failures: UnlockFailures): number | null {
  return failures.since === null ? null : failures.since.getTime() + UNLOCK_FAILURE_WINDOW_MS;
}

export function secondsUntilUnlockable(failures: UnlockFailures, now: Date): number | null {
  const end = windowEnd(failures);
  if (end === null || end <= now.getTime() || failures.count < MAX_FAILED_UNLOCKS) {
    return null;
  }
  return Math.ceil((end - now.getTime()) / MILLISECONDS_PER_SECOND);
}

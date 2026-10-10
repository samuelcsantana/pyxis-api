import type { AdminSession } from '../entities/admin-session.entity';
import type { RandomSource } from '../services/random-source';

export const SESSION_ABSOLUTE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_IDLE_TTL_MS = 24 * 60 * 60 * 1000;
export const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;
export const SESSION_TOKEN_BYTES = 32;
export const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateSessionToken(random: RandomSource): string {
  return Buffer.from(random.bytes(SESSION_TOKEN_BYTES)).toString('base64url');
}

export function isSessionActive(session: AdminSession, now: Date): boolean {
  const time = now.getTime();
  return (
    time - session.createdAt.getTime() < SESSION_ABSOLUTE_TTL_MS &&
    time - session.lastUsedAt.getTime() < SESSION_IDLE_TTL_MS
  );
}

export function needsTouch(session: AdminSession, now: Date): boolean {
  return now.getTime() - session.lastUsedAt.getTime() >= SESSION_TOUCH_INTERVAL_MS;
}

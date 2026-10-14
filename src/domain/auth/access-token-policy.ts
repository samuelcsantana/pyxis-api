import type { AccessToken } from '../entities/access-token.entity';
import { bearerCredential, randomKeyBody } from '../keys/project-keys';
import type { RandomSource } from '../services/random-source';
import { SESSION_TOUCH_INTERVAL_MS } from './session-policy';

export const ACCESS_TOKEN_PREFIX = 'pyxis_at_';
export const ACCESS_TOKEN_PATTERN = /^pyxis_at_[A-Za-z0-9]{32}$/;
export const ACCESS_TOKEN_LIFETIMES_DAYS = [30, 90, 365] as const;
export const DEFAULT_ACCESS_TOKEN_LIFETIME_DAYS = 90;
export const MAX_LIVE_ACCESS_TOKENS = 10;
export const MAX_ACCESS_TOKEN_NAME_LENGTH = 64;
export const ACCESS_TOKEN_TOUCH_INTERVAL_MS = SESSION_TOUCH_INTERVAL_MS;

export type AccessTokenLifetimeDays = (typeof ACCESS_TOKEN_LIFETIMES_DAYS)[number];

const MILLISECONDS_PER_DAY = 86_400_000;

export function generateAccessToken(random: RandomSource): string {
  return `${ACCESS_TOKEN_PREFIX}${randomKeyBody(random)}`;
}

export function accessTokenExpiry(createdAt: Date, lifetimeDays: AccessTokenLifetimeDays): Date {
  return new Date(createdAt.getTime() + lifetimeDays * MILLISECONDS_PER_DAY);
}

export function isAccessTokenActive(token: AccessToken, now: Date): boolean {
  return now.getTime() < token.expiresAt.getTime();
}

export function accessTokenNeedsTouch(token: AccessToken, now: Date): boolean {
  return (
    token.lastUsedAt === null ||
    now.getTime() - token.lastUsedAt.getTime() >= ACCESS_TOKEN_TOUCH_INTERVAL_MS
  );
}

export function accessTokenFromAuthorization(header: string | undefined): string | null {
  const candidate = bearerCredential(header);
  return candidate !== null && ACCESS_TOKEN_PATTERN.test(candidate) ? candidate : null;
}

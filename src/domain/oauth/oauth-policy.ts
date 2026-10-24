import { createHash } from 'node:crypto';
import { equalHashes } from '../auth/hashing';
import { SESSION_TOUCH_INTERVAL_MS } from '../auth/session-policy';
import { bearerCredential } from '../keys/project-keys';
import type { RandomSource } from '../services/random-source';

export const CONNECTION_ACCESS_TOKEN_PREFIX = 'pyxis_oat_';
export const CONNECTION_REFRESH_TOKEN_PREFIX = 'pyxis_ort_';
export const OAUTH_SECRET_BYTES = 32;
export const CONNECTION_ACCESS_TOKEN_PATTERN = /^pyxis_oat_[A-Za-z0-9_-]{43}$/;
export const CONNECTION_REFRESH_TOKEN_PATTERN = /^pyxis_ort_[A-Za-z0-9_-]{43}$/;
export const AUTHORIZATION_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const CODE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
export const CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const CODE_CHALLENGE_METHOD = 'S256';
export const OAUTH_SCOPE = 'read';
export const MCP_PATH = '/mcp';

export const AUTHORIZATION_REQUEST_TTL_MS = 10 * 60 * 1000;
export const AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1000;
export const CONNECTION_ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const CONNECTION_IDLE_TTL_DAYS = 90;
export const MAX_LIVE_CONNECTIONS = 10;
export const REFRESH_REPLAY_GRACE_MS = 60 * 1000;
export const MAX_LIVE_ACCESS_TOKENS_FOR_REPLAY = 3;
export const CONNECTION_TOUCH_INTERVAL_MS = SESSION_TOUCH_INTERVAL_MS;
export const SPENT_REFRESH_TOKEN_RETENTION_DAYS = 30;
export const FINISHED_AUTHORIZATION_REQUEST_RETENTION_DAYS = 1;

export const MAX_CLIENT_ID_LENGTH = 255;
export const MAX_REDIRECT_URI_LENGTH = 512;
export const MAX_STATE_LENGTH = 512;

const MILLISECONDS_PER_DAY = 86_400_000;
const CONNECTION_ACCESS_TOKEN_TTL_MS = CONNECTION_ACCESS_TOKEN_TTL_SECONDS * 1000;
const CONNECTION_IDLE_TTL_MS = CONNECTION_IDLE_TTL_DAYS * MILLISECONDS_PER_DAY;

export const CONNECTION_TOKEN_KINDS = ['access', 'refresh'] as const;
export type ConnectionTokenKind = (typeof CONNECTION_TOKEN_KINDS)[number];

function randomSecret(random: RandomSource): string {
  return Buffer.from(random.bytes(OAUTH_SECRET_BYTES)).toString('base64url');
}

export function generateAuthorizationCode(random: RandomSource): string {
  return randomSecret(random);
}

export function generateConnectionAccessToken(random: RandomSource): string {
  return `${CONNECTION_ACCESS_TOKEN_PREFIX}${randomSecret(random)}`;
}

export function generateConnectionRefreshToken(random: RandomSource): string {
  return `${CONNECTION_REFRESH_TOKEN_PREFIX}${randomSecret(random)}`;
}

export function codeChallengeOf(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function verifierMatches(verifier: string, challenge: string): boolean {
  return CODE_VERIFIER_PATTERN.test(verifier) && equalHashes(codeChallengeOf(verifier), challenge);
}

export function mcpResourceOf(issuer: string): string {
  return `${issuer}${MCP_PATH}`;
}

export function later(at: Date, milliseconds: number): Date {
  return new Date(at.getTime() + milliseconds);
}

export function accessTokenExpiry(issuedAt: Date): Date {
  return later(issuedAt, CONNECTION_ACCESS_TOKEN_TTL_MS);
}

export function refreshTokenExpiry(issuedAt: Date): Date {
  return later(issuedAt, CONNECTION_IDLE_TTL_MS);
}

export function idleConnectionCutoff(now: Date): Date {
  return later(now, -CONNECTION_IDLE_TTL_MS);
}

export function isConnectionIdle(lastUsedAt: Date, now: Date): boolean {
  return lastUsedAt.getTime() <= idleConnectionCutoff(now).getTime();
}

export function connectionNeedsTouch(lastUsedAt: Date, now: Date): boolean {
  return now.getTime() - lastUsedAt.getTime() >= CONNECTION_TOUCH_INTERVAL_MS;
}

export function isWithinReplayGrace(rotatedAt: Date, now: Date): boolean {
  return now.getTime() - rotatedAt.getTime() <= REFRESH_REPLAY_GRACE_MS;
}

export function hasReachedReplayCap(liveAccessTokens: number): boolean {
  return liveAccessTokens >= MAX_LIVE_ACCESS_TOKENS_FOR_REPLAY;
}

export function connectionAccessTokenFromAuthorization(header: string | undefined): string | null {
  const candidate = bearerCredential(header);
  return candidate !== null && CONNECTION_ACCESS_TOKEN_PATTERN.test(candidate) ? candidate : null;
}

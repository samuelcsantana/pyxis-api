export const INGEST_THROTTLER = 'ingest';
export const CLIENT_BATCHES_PER_WINDOW = 120;
export const CLIENT_RATE_WINDOW_MS = 60_000;

export const AUTH_THROTTLER = 'auth';
export const SIGN_IN_REQUESTS_PER_WINDOW = 5;
export const SIGN_IN_RATE_WINDOW_MS = 15 * 60 * 1000;

export const SUBJECTS_THROTTLER = 'subjects';
export const SUBJECT_REQUESTS_PER_WINDOW = 60;
export const SUBJECT_RATE_WINDOW_MS = 60_000;

export const ACCESS_TOKENS_THROTTLER = 'access-tokens';
export const ACCESS_TOKEN_REQUESTS_PER_WINDOW = 60;
export const ACCESS_TOKEN_RATE_WINDOW_MS = 60_000;
export const MCP_MESSAGES_PER_WINDOW = 120;

export const OAUTH_THROTTLER = 'oauth';
export const OAUTH_TOKEN_REQUESTS_PER_WINDOW = 600;
export const OAUTH_AUTHORIZE_REQUESTS_PER_WINDOW = 60;
export const OAUTH_RATE_WINDOW_MS = 60_000;

export const THROTTLERS = [
  { name: INGEST_THROTTLER, ttl: CLIENT_RATE_WINDOW_MS, limit: CLIENT_BATCHES_PER_WINDOW },
  { name: AUTH_THROTTLER, ttl: SIGN_IN_RATE_WINDOW_MS, limit: SIGN_IN_REQUESTS_PER_WINDOW },
  { name: SUBJECTS_THROTTLER, ttl: SUBJECT_RATE_WINDOW_MS, limit: SUBJECT_REQUESTS_PER_WINDOW },
  {
    name: ACCESS_TOKENS_THROTTLER,
    ttl: ACCESS_TOKEN_RATE_WINDOW_MS,
    limit: ACCESS_TOKEN_REQUESTS_PER_WINDOW,
  },
  { name: OAUTH_THROTTLER, ttl: OAUTH_RATE_WINDOW_MS, limit: OAUTH_TOKEN_REQUESTS_PER_WINDOW },
] as const;

export type ThrottlerName = (typeof THROTTLERS)[number]['name'];

export function skipThrottlersExcept(
  ...used: readonly ThrottlerName[]
): Readonly<Record<string, true>> {
  return Object.fromEntries(
    THROTTLERS.filter(({ name }) => !used.includes(name)).map(({ name }) => [name, true]),
  );
}

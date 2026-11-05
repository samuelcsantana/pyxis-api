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

export const ARRIVALS_THROTTLER = 'arrivals';
export const ARRIVALS_REQUESTS_PER_WINDOW = 30;
export const ARRIVALS_RATE_WINDOW_MS = 60_000;

export const SHARED_REPORTS_THROTTLER = 'shared-reports';
export const SHARED_REPORT_REQUESTS_PER_WINDOW = 120;
export const SHARED_REPORTS_RATE_WINDOW_MS = 60_000;

export const SHARE_UNLOCK_THROTTLER = 'share-unlock';
export const SHARE_UNLOCKS_PER_WINDOW = 20;
export const SHARE_UNLOCK_RATE_WINDOW_MS = 15 * 60 * 1000;

export const SLACK_TEST_THROTTLER = 'slack-test';
export const SLACK_TESTS_PER_WINDOW = 10;
export const SLACK_TEST_RATE_WINDOW_MS = 15 * 60 * 1000;

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
  { name: ARRIVALS_THROTTLER, ttl: ARRIVALS_RATE_WINDOW_MS, limit: ARRIVALS_REQUESTS_PER_WINDOW },
  {
    name: SHARED_REPORTS_THROTTLER,
    ttl: SHARED_REPORTS_RATE_WINDOW_MS,
    limit: SHARED_REPORT_REQUESTS_PER_WINDOW,
  },
  {
    name: SHARE_UNLOCK_THROTTLER,
    ttl: SHARE_UNLOCK_RATE_WINDOW_MS,
    limit: SHARE_UNLOCKS_PER_WINDOW,
  },
  { name: SLACK_TEST_THROTTLER, ttl: SLACK_TEST_RATE_WINDOW_MS, limit: SLACK_TESTS_PER_WINDOW },
] as const;

export type ThrottlerName = (typeof THROTTLERS)[number]['name'];

export function skipThrottlersExcept(
  ...used: readonly ThrottlerName[]
): Readonly<Record<string, true>> {
  return Object.fromEntries(
    THROTTLERS.filter(({ name }) => !used.includes(name)).map(({ name }) => [name, true]),
  );
}

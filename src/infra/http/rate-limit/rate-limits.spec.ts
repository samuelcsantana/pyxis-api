import {
  ACCESS_TOKEN_RATE_WINDOW_MS,
  ARRIVALS_RATE_WINDOW_MS,
  ARRIVALS_REQUESTS_PER_WINDOW,
  ARRIVALS_THROTTLER,
  ACCESS_TOKEN_REQUESTS_PER_WINDOW,
  ACCESS_TOKENS_THROTTLER,
  AUTH_THROTTLER,
  CLIENT_BATCHES_PER_WINDOW,
  CLIENT_RATE_WINDOW_MS,
  INGEST_THROTTLER,
  MCP_MESSAGES_PER_WINDOW,
  OAUTH_AUTHORIZE_REQUESTS_PER_WINDOW,
  OAUTH_RATE_WINDOW_MS,
  OAUTH_THROTTLER,
  OAUTH_TOKEN_REQUESTS_PER_WINDOW,
  SIGN_IN_RATE_WINDOW_MS,
  SHARED_REPORT_REQUESTS_PER_WINDOW,
  SHARED_REPORTS_RATE_WINDOW_MS,
  SHARED_REPORTS_THROTTLER,
  SHARE_UNLOCK_RATE_WINDOW_MS,
  SHARE_UNLOCK_THROTTLER,
  SHARE_UNLOCKS_PER_WINDOW,
  SIGN_IN_REQUESTS_PER_WINDOW,
  SUBJECT_RATE_WINDOW_MS,
  SUBJECT_REQUESTS_PER_WINDOW,
  SUBJECTS_THROTTLER,
  skipThrottlersExcept,
  THROTTLERS,
} from './rate-limits';

describe('rate limits', () => {
  it('lets one address send 120 batches a minute to ingestion', () => {
    expect({ INGEST_THROTTLER, CLIENT_BATCHES_PER_WINDOW, CLIENT_RATE_WINDOW_MS }).toEqual({
      INGEST_THROTTLER: 'ingest',
      CLIENT_BATCHES_PER_WINDOW: 120,
      CLIENT_RATE_WINDOW_MS: 60_000,
    });
  });

  it('lets one address try to sign in five times every fifteen minutes', () => {
    expect({ AUTH_THROTTLER, SIGN_IN_REQUESTS_PER_WINDOW, SIGN_IN_RATE_WINDOW_MS }).toEqual({
      AUTH_THROTTLER: 'auth',
      SIGN_IN_REQUESTS_PER_WINDOW: 5,
      SIGN_IN_RATE_WINDOW_MS: 900_000,
    });
  });

  it('lets one secret key call the subject routes sixty times a minute', () => {
    expect({ SUBJECTS_THROTTLER, SUBJECT_REQUESTS_PER_WINDOW, SUBJECT_RATE_WINDOW_MS }).toEqual({
      SUBJECTS_THROTTLER: 'subjects',
      SUBJECT_REQUESTS_PER_WINDOW: 60,
      SUBJECT_RATE_WINDOW_MS: 60_000,
    });
  });

  it('lets one access token read the dashboard routes sixty times a minute', () => {
    expect({
      ACCESS_TOKENS_THROTTLER,
      ACCESS_TOKEN_REQUESTS_PER_WINDOW,
      ACCESS_TOKEN_RATE_WINDOW_MS,
    }).toEqual({
      ACCESS_TOKENS_THROTTLER: 'access-tokens',
      ACCESS_TOKEN_REQUESTS_PER_WINDOW: 60,
      ACCESS_TOKEN_RATE_WINDOW_MS: 60_000,
    });
  });

  it('lets one token send the MCP endpoint twice as many messages as tool reads', () => {
    expect({ MCP_MESSAGES_PER_WINDOW, ACCESS_TOKEN_RATE_WINDOW_MS }).toEqual({
      MCP_MESSAGES_PER_WINDOW: 2 * ACCESS_TOKEN_REQUESTS_PER_WINDOW,
      ACCESS_TOKEN_RATE_WINDOW_MS: 60_000,
    });
    expect(MCP_MESSAGES_PER_WINDOW).toBe(120);
  });

  it('registers each throttler once, with its own window and limit', () => {
    expect(THROTTLERS).toEqual([
      { name: 'ingest', ttl: 60_000, limit: 120 },
      { name: 'auth', ttl: 900_000, limit: 5 },
      { name: 'subjects', ttl: 60_000, limit: 60 },
      { name: 'access-tokens', ttl: 60_000, limit: 60 },
      { name: 'oauth', ttl: 60_000, limit: 600 },
      { name: 'arrivals', ttl: 60_000, limit: 30 },
      { name: 'shared-reports', ttl: 60_000, limit: 120 },
      { name: 'share-unlock', ttl: 900_000, limit: 20 },
    ]);
  });

  it('lets one session ask what arrived thirty times a minute, room for a few visible tabs', () => {
    expect({ ARRIVALS_THROTTLER, ARRIVALS_REQUESTS_PER_WINDOW, ARRIVALS_RATE_WINDOW_MS }).toEqual({
      ARRIVALS_THROTTLER: 'arrivals',
      ARRIVALS_REQUESTS_PER_WINDOW: 30,
      ARRIVALS_RATE_WINDOW_MS: 60_000,
    });
  });

  it('lets one address read shared reports 120 times a minute, a few screens of filters', () => {
    expect({
      SHARED_REPORTS_THROTTLER,
      SHARED_REPORT_REQUESTS_PER_WINDOW,
      SHARED_REPORTS_RATE_WINDOW_MS,
    }).toEqual({
      SHARED_REPORTS_THROTTLER: 'shared-reports',
      SHARED_REPORT_REQUESTS_PER_WINDOW: 120,
      SHARED_REPORTS_RATE_WINDOW_MS: 60_000,
    });
  });

  it('lets one address try twenty share link passwords every fifteen minutes', () => {
    expect({
      SHARE_UNLOCK_THROTTLER,
      SHARE_UNLOCKS_PER_WINDOW,
      SHARE_UNLOCK_RATE_WINDOW_MS,
    }).toEqual({
      SHARE_UNLOCK_THROTTLER: 'share-unlock',
      SHARE_UNLOCKS_PER_WINDOW: 20,
      SHARE_UNLOCK_RATE_WINDOW_MS: 900_000,
    });
  });

  it('skips every registered throttler but the ones a route uses', () => {
    expect(skipThrottlersExcept(AUTH_THROTTLER)).toEqual({
      ingest: true,
      subjects: true,
      'access-tokens': true,
      oauth: true,
      arrivals: true,
      'shared-reports': true,
      'share-unlock': true,
    });
    expect(skipThrottlersExcept(INGEST_THROTTLER, OAUTH_THROTTLER)).toEqual({
      auth: true,
      subjects: true,
      'access-tokens': true,
      arrivals: true,
      'shared-reports': true,
      'share-unlock': true,
    });
    expect(Object.keys(skipThrottlersExcept())).toEqual(THROTTLERS.map(({ name }) => name));
  });

  it('only breaks the circuit for an address that floods the token endpoint', () => {
    expect({
      OAUTH_THROTTLER,
      OAUTH_TOKEN_REQUESTS_PER_WINDOW,
      OAUTH_AUTHORIZE_REQUESTS_PER_WINDOW,
      OAUTH_RATE_WINDOW_MS,
    }).toEqual({
      OAUTH_THROTTLER: 'oauth',
      OAUTH_TOKEN_REQUESTS_PER_WINDOW: 600,
      OAUTH_AUTHORIZE_REQUESTS_PER_WINDOW: 60,
      OAUTH_RATE_WINDOW_MS: 60_000,
    });
  });
});

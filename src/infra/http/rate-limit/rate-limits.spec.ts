import {
  AUTH_THROTTLER,
  CLIENT_BATCHES_PER_WINDOW,
  CLIENT_RATE_WINDOW_MS,
  INGEST_THROTTLER,
  SIGN_IN_RATE_WINDOW_MS,
  SIGN_IN_REQUESTS_PER_WINDOW,
  SUBJECT_RATE_WINDOW_MS,
  SUBJECT_REQUESTS_PER_WINDOW,
  SUBJECTS_THROTTLER,
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
});

export const INGEST_THROTTLER = 'ingest';
export const CLIENT_BATCHES_PER_WINDOW = 120;
export const CLIENT_RATE_WINDOW_MS = 60_000;

export const AUTH_THROTTLER = 'auth';
export const SIGN_IN_REQUESTS_PER_WINDOW = 5;
export const SIGN_IN_RATE_WINDOW_MS = 15 * 60 * 1000;

export const SUBJECTS_THROTTLER = 'subjects';
export const SUBJECT_REQUESTS_PER_WINDOW = 60;
export const SUBJECT_RATE_WINDOW_MS = 60_000;

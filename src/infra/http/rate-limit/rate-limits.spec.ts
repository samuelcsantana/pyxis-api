import { CLIENT_BATCHES_PER_WINDOW, CLIENT_RATE_WINDOW_MS, INGEST_THROTTLER } from './rate-limits';

describe('rate limits', () => {
  it('lets one address send 120 batches a minute to ingestion', () => {
    expect({ INGEST_THROTTLER, CLIENT_BATCHES_PER_WINDOW, CLIENT_RATE_WINDOW_MS }).toEqual({
      INGEST_THROTTLER: 'ingest',
      CLIENT_BATCHES_PER_WINDOW: 120,
      CLIENT_RATE_WINDOW_MS: 60_000,
    });
  });
});

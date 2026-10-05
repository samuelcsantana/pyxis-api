import { MAX_EVENTS_PER_BATCH } from '../../../domain/events/event-limits';
import { PUBLIC_KEY_PREFIX } from '../../../domain/keys/project-keys';
import {
  batchEnvelopeSchema,
  batchRequestSchema,
  errorResponseSchema,
  ingestResultSchema,
} from './ingest.schemas';

const KEY = `${PUBLIC_KEY_PREFIX}${'A'.repeat(32)}`;
const SENT_AT = '2026-10-06T14:03:11.120Z';
const EVENT = {
  id: '9f1c2b3a-1d2e-4f5a-8b6c-7d8e9f0a1b2c',
  name: 'page_view',
  occurred_at: '2026-10-06T14:03:10.004Z',
  session_id: '0b7e1c2d-3f4a-4b5c-9d6e-7f8a9b0c1d2e',
  path: '/pricing',
};

describe('batchEnvelopeSchema', () => {
  it('accepts a batch and leaves the events for per-event validation', () => {
    const batch = { key: KEY, sent_at: SENT_AT, events: [EVENT, { anything: true }] };

    expect(batchEnvelopeSchema.parse(batch)).toEqual(batch);
  });

  it('accepts more than the documented maximum, which the use case answers with 413', () => {
    const events = Array.from({ length: MAX_EVENTS_PER_BATCH + 1 }, () => EVENT);

    expect(batchEnvelopeSchema.safeParse({ key: KEY, sent_at: SENT_AT, events }).success).toBe(
      true,
    );
  });

  it.each([
    ['an unknown top-level field', { key: KEY, sent_at: SENT_AT, events: [EVENT], extra: 1 }],
    ['zero events', { key: KEY, sent_at: SENT_AT, events: [] }],
    ['a key in another format', { key: 'pk_live_abc', sent_at: SENT_AT, events: [EVENT] }],
    ['a sent_at without an offset', { key: KEY, sent_at: '2026-10-06T14:03:11', events: [EVENT] }],
    ['events that are not a list', { key: KEY, sent_at: SENT_AT, events: EVENT }],
  ])('rejects %s', (_, batch) => {
    expect(batchEnvelopeSchema.safeParse(batch).success).toBe(false);
  });
});

describe('batchRequestSchema', () => {
  it('describes a valid batch, as the SDK sends it', () => {
    expect(
      batchRequestSchema.safeParse({ key: KEY, sent_at: SENT_AT, events: [EVENT] }).success,
    ).toBe(true);
  });

  it('documents the limit of events per batch', () => {
    const events = Array.from({ length: MAX_EVENTS_PER_BATCH + 1 }, () => EVENT);

    expect(batchRequestSchema.safeParse({ key: KEY, sent_at: SENT_AT, events }).success).toBe(
      false,
    );
  });
});

describe('response schemas', () => {
  it('describe the counts of an ingested batch', () => {
    expect(ingestResultSchema.parse({ accepted: 2, duplicates: 0, rejected: 1 })).toEqual({
      accepted: 2,
      duplicates: 0,
      rejected: 1,
    });
  });

  it('describe the error body', () => {
    expect(
      errorResponseSchema.safeParse({
        status_code: 401,
        error: 'unknown_key',
        message: 'Unknown key.',
      }).success,
    ).toBe(true);
  });
});

import { MAX_OCCURRED_AT_AGE_MS } from './event-limits';
import { correctOccurredAt } from './occurred-at';

const RECEIVED_AT = new Date('2026-10-06T14:00:00.000Z');
const SECOND = 1000;
const DAY = 24 * 60 * 60 * SECOND;

function at(offsetMs: number): Date {
  return new Date(RECEIVED_AT.getTime() + offsetMs);
}

describe('correctOccurredAt', () => {
  it('shifts the browser time by the skew measured when the batch was sent', () => {
    const browserAheadBy = 90 * SECOND;
    const sentAt = at(browserAheadBy);
    const occurredAt = at(browserAheadBy - 4 * SECOND);

    expect(correctOccurredAt(occurredAt, sentAt, RECEIVED_AT)).toEqual(at(-4 * SECOND));
  });

  it('keeps the browser time when the clocks agree', () => {
    expect(correctOccurredAt(at(-SECOND), RECEIVED_AT, RECEIVED_AT)).toEqual(at(-SECOND));
  });

  it('replaces a corrected time that lands in the future', () => {
    expect(correctOccurredAt(at(5 * SECOND), RECEIVED_AT, RECEIVED_AT)).toBe(RECEIVED_AT);
  });

  it('keeps a corrected time equal to the reception', () => {
    expect(correctOccurredAt(RECEIVED_AT, RECEIVED_AT, RECEIVED_AT)).toEqual(RECEIVED_AT);
  });

  it('replaces a time more than seven days old', () => {
    expect(correctOccurredAt(at(-8 * DAY), RECEIVED_AT, RECEIVED_AT)).toBe(RECEIVED_AT);
  });

  it('keeps a time exactly seven days old', () => {
    expect(correctOccurredAt(at(-MAX_OCCURRED_AT_AGE_MS), RECEIVED_AT, RECEIVED_AT)).toEqual(
      at(-MAX_OCCURRED_AT_AGE_MS),
    );
  });

  it('replaces a time one millisecond past seven days', () => {
    expect(correctOccurredAt(at(-MAX_OCCURRED_AT_AGE_MS - 1), RECEIVED_AT, RECEIVED_AT)).toBe(
      RECEIVED_AT,
    );
  });
});

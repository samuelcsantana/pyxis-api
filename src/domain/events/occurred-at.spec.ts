import { MAX_DELIVERY_DELAY_MS, MAX_OCCURRED_AT_AGE_MS } from './event-limits';
import { correctOccurredAt } from './occurred-at';

const RECEIVED_AT = new Date('2026-10-06T14:00:00.000Z');
const SECOND = 1000;
const HOUR = 60 * 60 * SECOND;
const DAY = 24 * HOUR;

function at(offsetMs: number): Date {
  return new Date(RECEIVED_AT.getTime() + offsetMs);
}

describe('correctOccurredAt', () => {
  it('shifts the time of a browser whose clock is ahead by the skew measured at sending', () => {
    const browserAheadBy = 90 * SECOND;
    const sentAt = at(browserAheadBy);
    const occurredAt = at(browserAheadBy - 4 * SECOND);

    expect(correctOccurredAt(occurredAt, sentAt, RECEIVED_AT)).toEqual(at(-4 * SECOND));
  });

  it('shifts the time of a browser whose clock is behind by the longest delivery delay', () => {
    const sentAt = at(-MAX_DELIVERY_DELAY_MS);
    const occurredAt = at(-MAX_DELIVERY_DELAY_MS - 4 * SECOND);

    expect(correctOccurredAt(occurredAt, sentAt, RECEIVED_AT)).toEqual(at(-4 * SECOND));
  });

  it('shifts the time of a browser whose clock is hours behind', () => {
    const sentAt = at(-3 * HOUR);
    const occurredAt = at(-3 * HOUR - 4 * SECOND);

    expect(correctOccurredAt(occurredAt, sentAt, RECEIVED_AT)).toEqual(at(-4 * SECOND));
  });

  it('keeps the browser time when a retried batch arrives just under the longest delivery delay', () => {
    const sentAt = at(-MAX_DELIVERY_DELAY_MS + 1);
    const occurredAt = at(-MAX_DELIVERY_DELAY_MS - 4 * SECOND);

    expect(correctOccurredAt(occurredAt, sentAt, RECEIVED_AT)).toEqual(occurredAt);
  });

  it('keeps the browser time when the clocks agree', () => {
    expect(correctOccurredAt(at(-SECOND), RECEIVED_AT, RECEIVED_AT)).toEqual(at(-SECOND));
  });

  it('keeps the browser time when the batch reaches a cold function seconds after it was sent', () => {
    const sentAt = at(-4_300);
    const occurredAt = at(-6_300);

    expect(correctOccurredAt(occurredAt, sentAt, RECEIVED_AT)).toEqual(occurredAt);
  });

  it('keeps the events of one visit in order when its first batch goes through a cold start', () => {
    const coldStartMs = 4_300;
    const firstBatchEvent = at(0);
    const firstBatchSentAt = at(SECOND);
    const firstBatchReceivedAt = at(SECOND + coldStartMs);
    const secondBatchEvent = at(2 * SECOND);
    const secondBatchSentAt = at(6 * SECOND);
    const secondBatchReceivedAt = at(6 * SECOND + 100);

    const first = correctOccurredAt(firstBatchEvent, firstBatchSentAt, firstBatchReceivedAt);
    const second = correctOccurredAt(secondBatchEvent, secondBatchSentAt, secondBatchReceivedAt);

    expect(first.getTime()).toBeLessThan(second.getTime());
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

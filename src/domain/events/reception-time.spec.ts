import { MAX_ARRIVAL_AGE_MS } from './event-limits';
import { receptionTime } from './reception-time';

const NOW = new Date('2026-10-06T14:00:10.000Z');

function before(offsetMs: number): Date {
  return new Date(NOW.getTime() - offsetMs);
}

describe('receptionTime', () => {
  it('is the arrival of a request that waited for a cold start', () => {
    expect(receptionTime(before(4_300), NOW)).toEqual(before(4_300));
  });

  it('is the arrival when it equals the clock', () => {
    expect(receptionTime(before(0), NOW)).toEqual(NOW);
  });

  it('is the clock when the arrival is unknown', () => {
    expect(receptionTime(undefined, NOW)).toBe(NOW);
  });

  it('is the clock when the arrival is later than the clock', () => {
    expect(receptionTime(before(-1), NOW)).toBe(NOW);
  });

  it('keeps an arrival as old as the longest a request is handled', () => {
    expect(receptionTime(before(MAX_ARRIVAL_AGE_MS), NOW)).toEqual(before(MAX_ARRIVAL_AGE_MS));
  });

  it('is the clock when the arrival is older than any request is handled', () => {
    expect(receptionTime(before(MAX_ARRIVAL_AGE_MS + 1), NOW)).toBe(NOW);
  });
});

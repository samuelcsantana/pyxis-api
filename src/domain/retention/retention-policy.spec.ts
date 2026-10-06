import { eventRetentionCutoff } from './retention-policy';

describe('eventRetentionCutoff', () => {
  it('is thirteen months before now, to the millisecond', () => {
    expect(eventRetentionCutoff(new Date('2026-10-06T03:20:15.250Z'))).toEqual(
      new Date('2025-09-06T03:20:15.250Z'),
    );
  });

  it('crosses the year when it has to', () => {
    expect(eventRetentionCutoff(new Date('2027-01-15T00:00:00.000Z'))).toEqual(
      new Date('2025-12-15T00:00:00.000Z'),
    );
  });

  it('keeps to the last day of a shorter month instead of spilling into the next', () => {
    expect(eventRetentionCutoff(new Date('2027-03-31T12:00:00.000Z'))).toEqual(
      new Date('2026-02-28T12:00:00.000Z'),
    );
  });
});

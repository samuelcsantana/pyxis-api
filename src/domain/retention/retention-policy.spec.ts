import { eventRetentionCutoff, trialCardRetentionCutoff } from './retention-policy';

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

describe('trialCardRetentionCutoff', () => {
  it('is twelve months before now, keeping to the last day of a shorter month', () => {
    expect(trialCardRetentionCutoff(new Date('2026-10-15T10:00:00.000Z'))).toEqual(
      new Date('2025-10-15T10:00:00.000Z'),
    );
    expect(trialCardRetentionCutoff(new Date('2028-02-29T00:00:00.000Z'))).toEqual(
      new Date('2027-02-28T00:00:00.000Z'),
    );
  });
});

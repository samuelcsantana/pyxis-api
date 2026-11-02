import { visitorPeriodOf } from './visitor-period';

function periodOf(timeZone: string, receivedAt: string) {
  const { dayEndsAt, monthEndsAt } = visitorPeriodOf(timeZone, new Date(receivedAt));
  return { dayEndsAt: dayEndsAt.toISOString(), monthEndsAt: monthEndsAt.toISOString() };
}

describe('visitorPeriodOf', () => {
  it("ends the day at the next local midnight and the month at the next month's first one", () => {
    expect(periodOf('America/Sao_Paulo', '2026-11-02T15:00:00.000Z')).toEqual({
      dayEndsAt: '2026-11-03T03:00:00.000Z',
      monthEndsAt: '2026-12-01T03:00:00.000Z',
    });
  });

  it('ends the day one millisecond later at the last moment of a local day', () => {
    expect(periodOf('America/Sao_Paulo', '2026-11-03T02:59:59.999Z').dayEndsAt).toBe(
      '2026-11-03T03:00:00.000Z',
    );
  });

  it('starts counting a new day at the local midnight itself', () => {
    expect(periodOf('America/Sao_Paulo', '2026-11-03T03:00:00.000Z').dayEndsAt).toBe(
      '2026-11-04T03:00:00.000Z',
    );
  });

  it('ends the day and the month together on the last day of the year', () => {
    expect(periodOf('America/Sao_Paulo', '2026-12-31T20:00:00.000Z')).toEqual({
      dayEndsAt: '2027-01-01T03:00:00.000Z',
      monthEndsAt: '2027-01-01T03:00:00.000Z',
    });
  });

  it('counts the days of the UTC zone in UTC', () => {
    expect(periodOf('UTC', '2026-02-28T23:59:59.000Z')).toEqual({
      dayEndsAt: '2026-03-01T00:00:00.000Z',
      monthEndsAt: '2026-03-01T00:00:00.000Z',
    });
  });

  it('starts the day at 01:00 when summer time skipped the midnight (São Paulo, 2018)', () => {
    expect(periodOf('America/Sao_Paulo', '2018-11-03T20:00:00.000Z')).toEqual({
      dayEndsAt: '2018-11-04T03:00:00.000Z',
      monthEndsAt: '2018-12-01T02:00:00.000Z',
    });
  });

  it('ends the day after the repeated hour when summer time ended at midnight (São Paulo, 2018)', () => {
    expect(periodOf('America/Sao_Paulo', '2018-02-17T12:00:00.000Z')).toEqual({
      dayEndsAt: '2018-02-18T03:00:00.000Z',
      monthEndsAt: '2018-03-01T03:00:00.000Z',
    });
  });

  it('follows the offset of each midnight across the change to summer time (Berlin)', () => {
    expect(periodOf('Europe/Berlin', '2026-03-29T10:00:00.000Z')).toEqual({
      dayEndsAt: '2026-03-29T22:00:00.000Z',
      monthEndsAt: '2026-03-31T22:00:00.000Z',
    });
  });

  it('follows the offset of each midnight across the end of summer time (Berlin)', () => {
    expect(periodOf('Europe/Berlin', '2026-10-24T12:00:00.000Z')).toEqual({
      dayEndsAt: '2026-10-24T22:00:00.000Z',
      monthEndsAt: '2026-10-31T23:00:00.000Z',
    });
  });

  it('keeps the quarter-hour offset of the Chatham Islands', () => {
    expect(periodOf('Pacific/Chatham', '2026-11-02T00:00:00.000Z')).toEqual({
      dayEndsAt: '2026-11-02T10:15:00.000Z',
      monthEndsAt: '2026-11-30T10:15:00.000Z',
    });
  });

  it('ends the day at the start of the next day that exists when a zone skipped one (Samoa, 2011)', () => {
    expect(periodOf('Pacific/Apia', '2011-12-29T12:00:00.000Z')).toEqual({
      dayEndsAt: '2011-12-30T10:00:00.000Z',
      monthEndsAt: '2011-12-31T10:00:00.000Z',
    });
  });
});

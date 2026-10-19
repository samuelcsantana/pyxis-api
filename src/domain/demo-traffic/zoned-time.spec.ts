import { instantInZone } from './zoned-time';

const HOUR = 60;

describe('instantInZone', () => {
  it('reads a minute of a day as the wall clock of the time zone', () => {
    expect(instantInZone('2026-10-19', 9 * HOUR + 30, 'UTC')).toEqual(
      new Date('2026-10-19T09:30:00.000Z'),
    );
    expect(instantInZone('2026-10-19', 9 * HOUR + 30, 'America/Sao_Paulo')).toEqual(
      new Date('2026-10-19T12:30:00.000Z'),
    );
    expect(instantInZone('2026-10-19', 9 * HOUR, 'Asia/Kolkata')).toEqual(
      new Date('2026-10-19T03:30:00.000Z'),
    );
  });

  it('follows the clock across the start and the end of daylight saving time', () => {
    expect(instantInZone('2026-03-08', 1 * HOUR, 'America/New_York')).toEqual(
      new Date('2026-03-08T06:00:00.000Z'),
    );
    expect(instantInZone('2026-03-08', 3 * HOUR, 'America/New_York')).toEqual(
      new Date('2026-03-08T07:00:00.000Z'),
    );
    expect(instantInZone('2026-11-01', 0 * HOUR + 30, 'America/New_York')).toEqual(
      new Date('2026-11-01T04:30:00.000Z'),
    );
    expect(instantInZone('2026-11-01', 12 * HOUR, 'America/New_York')).toEqual(
      new Date('2026-11-01T17:00:00.000Z'),
    );
  });

  it('refuses what is not a calendar date', () => {
    expect(() => instantInZone('19/10/2026', 0, 'UTC')).toThrow('Not a calendar date: 19/10/2026');
  });
});

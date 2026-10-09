import { lastClosedWeek } from './digest-week';

const MONDAY_SEND_TIME = new Date('2026-10-12T11:00:00.000Z');

describe('lastClosedWeek', () => {
  it.each([
    ['São Paulo', 'America/Sao_Paulo', { from: '2026-10-05', to: '2026-10-11' }],
    ['UTC', 'UTC', { from: '2026-10-05', to: '2026-10-11' }],
    ['Kiritimati, already Tuesday', 'Pacific/Kiritimati', { from: '2026-10-05', to: '2026-10-11' }],
    ['UTC-12, still Sunday', 'Etc/GMT+12', { from: '2026-09-28', to: '2026-10-04' }],
  ])('takes the Monday to Sunday that ended last in %s', (_label, timeZone, week) => {
    expect(lastClosedWeek(MONDAY_SEND_TIME, timeZone)).toEqual(week);
  });

  it('never takes a Sunday that has not ended', () => {
    const lateSunday = new Date('2026-10-12T02:59:59.000Z');

    expect(lastClosedWeek(lateSunday, 'America/Sao_Paulo')).toEqual({
      from: '2026-09-28',
      to: '2026-10-04',
    });
  });

  it('takes the week that ended at the first midnight of Monday', () => {
    const mondayMidnight = new Date('2026-10-12T03:00:00.000Z');

    expect(lastClosedWeek(mondayMidnight, 'America/Sao_Paulo')).toEqual({
      from: '2026-10-05',
      to: '2026-10-11',
    });
  });

  it('crosses a month and a year', () => {
    expect(lastClosedWeek(new Date('2027-01-04T11:00:00.000Z'), 'UTC')).toEqual({
      from: '2026-12-28',
      to: '2027-01-03',
    });
  });
});

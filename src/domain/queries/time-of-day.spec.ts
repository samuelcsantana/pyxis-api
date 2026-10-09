import { HOURS_IN_A_DAY, WEEKDAYS, weekdayHours } from './time-of-day';

describe('weekdayHours', () => {
  it('places each count at its weekday and hour, Monday first, and zero everywhere else', () => {
    const report = weekdayHours([
      { weekday: 1, hour: 0, visits: 3 },
      { weekday: 7, hour: 23, visits: 2 },
      { weekday: 3, hour: 14, visits: 5 },
    ]);

    expect(report).toHaveLength(WEEKDAYS);
    expect(report.map((day) => day.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(report.every((day) => day.hours.length === HOURS_IN_A_DAY)).toBe(true);
    expect(report[0]?.hours[0]).toBe(3);
    expect(report[6]?.hours[23]).toBe(2);
    expect(report[2]?.hours[14]).toBe(5);
    expect(report.flatMap((day) => day.hours).reduce((sum, visits) => sum + visits, 0)).toBe(10);
  });

  it('answers a week of zeros when no visit started', () => {
    expect(weekdayHours([]).flatMap((day) => day.hours)).toEqual(
      Array.from({ length: WEEKDAYS * HOURS_IN_A_DAY }, () => 0),
    );
  });
});

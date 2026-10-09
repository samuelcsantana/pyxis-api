import { type DateRange, isoWeekday, shiftDays, todayIn } from '../queries/date-range';

export const DAYS_IN_A_WEEK = 7;

export function lastClosedWeek(now: Date, timeZone: string): DateRange {
  const today = todayIn(timeZone, now);
  const lastSunday = shiftDays(today, -isoWeekday(today));
  return { from: shiftDays(lastSunday, 1 - DAYS_IN_A_WEEK), to: lastSunday };
}

import { InvalidRangeError } from '../errors/query.errors';

export const MAX_RANGE_DAYS = 400;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 86_400_000;

export interface DateRange {
  readonly from: string;
  readonly to: string;
}

function calendarDate(isoDate: string): Date {
  const match = ISO_DATE.exec(isoDate);
  const date =
    match === null
      ? undefined
      : new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (!date?.toISOString().startsWith(isoDate)) {
    throw new InvalidRangeError();
  }
  return date;
}

function shift(date: Date, days: number): string {
  return new Date(date.getTime() + days * MILLISECONDS_PER_DAY).toISOString().slice(0, 10);
}

export function todayIn(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function localTimeIn(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  }).format(now);
}

export function comparisonCutoff(range: DateRange, timeZone: string, now: Date): string | null {
  return range.to === todayIn(timeZone, now) ? localTimeIn(timeZone, now) : null;
}

export function dayCount(range: DateRange): number {
  const span = calendarDate(range.to).getTime() - calendarDate(range.from).getTime();
  return Math.round(span / MILLISECONDS_PER_DAY) + 1;
}

export function checkedRange(from: string, to: string, today: string): DateRange {
  const range = { from, to };
  const days = dayCount(range);
  if (days < 1 || to > today || days > MAX_RANGE_DAYS) {
    throw new InvalidRangeError();
  }
  return range;
}

export function previousRange(range: DateRange): DateRange {
  const from = calendarDate(range.from);
  return { from: shift(from, -dayCount(range)), to: shift(from, -1) };
}

export function daysIn(range: DateRange): readonly string[] {
  const from = calendarDate(range.from);
  return Array.from({ length: dayCount(range) }, (_, index) => shift(from, index));
}

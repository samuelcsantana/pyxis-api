import { shiftDays } from '../queries/date-range';

export interface VisitorPeriod {
  readonly dayEndsAt: Date;
  readonly monthEndsAt: Date;
}

const MILLISECONDS_PER_SECOND = 1000;
const WIDEST_ZONE_OFFSET_SECONDS = 15 * 60 * 60;
const ISO_DATE_LENGTH = 10;

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function dateFormatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = dateFormatters.get(timeZone);
  if (cached !== undefined) {
    return cached;
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  dateFormatters.set(timeZone, formatter);
  return formatter;
}

function localDateAt(timeZone: string, epochMilliseconds: number): string {
  return dateFormatterFor(timeZone).format(epochMilliseconds);
}

function firstSecondOfDate(
  timeZone: string,
  isoDate: string,
  before: number,
  onOrAfter: number,
): number {
  if (onOrAfter - before <= 1) {
    return onOrAfter;
  }
  const middle = Math.floor((before + onOrAfter) / 2);
  return localDateAt(timeZone, middle * MILLISECONDS_PER_SECOND) < isoDate
    ? firstSecondOfDate(timeZone, isoDate, middle, onOrAfter)
    : firstSecondOfDate(timeZone, isoDate, before, middle);
}

function startOfLocalDate(timeZone: string, isoDate: string): Date {
  const midnightInUtc = Date.parse(`${isoDate}T00:00:00Z`) / MILLISECONDS_PER_SECOND;
  const second = firstSecondOfDate(
    timeZone,
    isoDate,
    midnightInUtc - WIDEST_ZONE_OFFSET_SECONDS,
    midnightInUtc + WIDEST_ZONE_OFFSET_SECONDS,
  );
  return new Date(second * MILLISECONDS_PER_SECOND);
}

function firstOfNextMonth(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, ISO_DATE_LENGTH);
}

export function visitorPeriodOf(timeZone: string, receivedAt: Date): VisitorPeriod {
  const today = localDateAt(timeZone, receivedAt.getTime());
  return {
    dayEndsAt: startOfLocalDate(timeZone, shiftDays(today, 1)),
    monthEndsAt: startOfLocalDate(timeZone, firstOfNextMonth(today)),
  };
}

const MILLISECONDS_PER_MINUTE = 60_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached !== undefined) {
    return cached;
  }
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
  formatters.set(timeZone, formatter);
  return formatter;
}

function zoneOffsetMs(timeZone: string, instant: number): number {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(new Date(instant))
      .map((part) => [part.type, part.value]),
  );
  const wallClock = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  );
  const wholeMinute = Math.floor(instant / MILLISECONDS_PER_MINUTE) * MILLISECONDS_PER_MINUTE;
  return wallClock - wholeMinute;
}

export function instantInZone(isoDate: string, minuteOfDay: number, timeZone: string): Date {
  const match = ISO_DATE.exec(isoDate);
  if (match === null) {
    throw new Error(`Not a calendar date: ${isoDate}`);
  }
  const wallClock = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    0,
    minuteOfDay,
  );
  const firstGuess = wallClock - zoneOffsetMs(timeZone, wallClock);
  return new Date(wallClock - zoneOffsetMs(timeZone, firstGuess));
}

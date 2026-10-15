export const EVENT_RETENTION_MONTHS = 13;
export const TRIAL_CARD_RETENTION_MONTHS = 12;
export const RETENTION_BATCH_SIZE = 10_000;

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function monthsBefore(now: Date, months: number): Date {
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1));
  const day = Math.min(
    now.getUTCDate(),
    daysInMonth(target.getUTCFullYear(), target.getUTCMonth()),
  );
  return new Date(
    Date.UTC(
      target.getUTCFullYear(),
      target.getUTCMonth(),
      day,
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds(),
    ),
  );
}

export function eventRetentionCutoff(now: Date): Date {
  return monthsBefore(now, EVENT_RETENTION_MONTHS);
}

export function trialCardRetentionCutoff(now: Date): Date {
  return monthsBefore(now, TRIAL_CARD_RETENTION_MONTHS);
}

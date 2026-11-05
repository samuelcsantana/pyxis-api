import { type AccountStatus, hasAccess } from '../accounts/account-status';
import type { FailureCount } from '../queries/overview';
import { type DateRange, shiftDays, todayIn } from '../queries/date-range';

export const SILENCE_MS = 24 * 60 * 60 * 1000;
export const ALERT_HISTORY_DAYS = 7;
export const MIN_VISITS_BEFORE_SILENCE = 20;
export const MIN_FAILED_WRITES = 10;
export const MIN_FAILURE_RATE = 0.1;
export const FAILURE_SPIKE_FACTOR = 2;
export const MIN_COMPARED_CONVERSIONS = 10;
export const CONVERSION_DROP_SHARE = 0.5;

export interface AlertDays {
  readonly day: string;
  readonly comparedDay: string;
  readonly history: DateRange;
  readonly usual: DateRange;
}

export interface AlertedAccount {
  readonly status: AccountStatus;
  readonly suspendedAt: Date | null;
  readonly ingestionPausedUntil: Date | null;
}

export function alertDays(timeZone: string, now: Date): AlertDays {
  const day = shiftDays(todayIn(timeZone, now), -1);
  return {
    day,
    comparedDay: shiftDays(day, -ALERT_HISTORY_DAYS),
    history: { from: shiftDays(day, 1 - ALERT_HISTORY_DAYS), to: day },
    usual: { from: shiftDays(day, -ALERT_HISTORY_DAYS), to: shiftDays(day, -1) },
  };
}

export function mayAlert(
  account: AlertedAccount | null,
  ingestionSuspended: boolean,
  now: Date,
): boolean {
  if (ingestionSuspended) {
    return false;
  }
  return (
    account === null ||
    (hasAccess(account.status) &&
      account.suspendedAt === null &&
      (account.ingestionPausedUntil === null ||
        account.ingestionPausedUntil.getTime() <= now.getTime()))
  );
}

export function isSilent(
  lastEventAt: Date | null,
  visitsBefore: number,
  now: Date,
): lastEventAt is Date {
  return (
    lastEventAt !== null &&
    now.getTime() - lastEventAt.getTime() >= SILENCE_MS &&
    visitsBefore >= MIN_VISITS_BEFORE_SILENCE
  );
}

export function failureRate(count: FailureCount): number {
  return count.total === 0 ? 0 : count.failed / count.total;
}

export function isFailureSpike(day: FailureCount, usual: FailureCount): boolean {
  const rate = failureRate(day);
  return (
    day.failed >= MIN_FAILED_WRITES &&
    rate >= MIN_FAILURE_RATE &&
    rate >= FAILURE_SPIKE_FACTOR * failureRate(usual)
  );
}

export function isConversionDrop(conversions: number, comparedConversions: number): boolean {
  return (
    comparedConversions >= MIN_COMPARED_CONVERSIONS &&
    conversions <= comparedConversions * CONVERSION_DROP_SHARE
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const EMPTY_FREE_ACCOUNT_DAYS = 30;
export const IDLE_FREE_ACCOUNT_DAYS = 90;
export const INACTIVITY_NOTICE_DAYS = 7;

export type FreeAccountInactivity = 'empty' | 'idle';

export interface FreeAccountActivity {
  readonly freeSince: Date;
  readonly lastEventAt: Date | null;
}

function daysAfter(moment: Date, days: number): Date {
  return new Date(moment.getTime() + days * DAY_MS);
}

function laterOf(first: Date, second: Date): Date {
  return first.getTime() >= second.getTime() ? first : second;
}

export function inactivityOf(
  activity: FreeAccountActivity,
  now: Date,
): FreeAccountInactivity | null {
  if (activity.lastEventAt === null) {
    return now >= daysAfter(activity.freeSince, EMPTY_FREE_ACCOUNT_DAYS) ? 'empty' : null;
  }
  const quietSince = laterOf(activity.lastEventAt, activity.freeSince);
  return now >= daysAfter(quietSince, IDLE_FREE_ACCOUNT_DAYS) ? 'idle' : null;
}

export function inactivityDeletionDueAt(notifiedAt: Date): Date {
  return daysAfter(notifiedAt, INACTIVITY_NOTICE_DAYS);
}

export function storedAnEventSince(lastEventAt: Date | null, notifiedAt: Date): boolean {
  return lastEventAt !== null && lastEventAt > notifiedAt;
}

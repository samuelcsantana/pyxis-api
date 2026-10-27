const DAY_MS = 24 * 60 * 60 * 1000;

export const DELETION_GRACE_DAYS = 30;
export const DELETION_REMINDER_DAYS = 7;
export const INCOMPLETE_ACCOUNT_DAYS = 7;
export const FREE_WAITLIST_DAYS = 60;
export const WITHDRAWAL_DAYS = 7;
export const ACCOUNT_DELETION_BATCH_SIZE = 5_000;

function daysBefore(moment: Date, days: number): Date {
  return new Date(moment.getTime() - days * DAY_MS);
}

export function deletionDueAt(accessEndsAt: Date): Date {
  return new Date(accessEndsAt.getTime() + DELETION_GRACE_DAYS * DAY_MS);
}

export function deletionThreshold(now: Date): Date {
  return daysBefore(now, DELETION_GRACE_DAYS);
}

export function reminderThreshold(now: Date): Date {
  return daysBefore(now, DELETION_GRACE_DAYS - DELETION_REMINDER_DAYS);
}

export interface StaleIncompleteThresholds {
  readonly createdBefore: Date;
  readonly waitlistedBefore: Date;
}

export function staleIncompleteThresholds(now: Date): StaleIncompleteThresholds {
  return {
    createdBefore: daysBefore(now, INCOMPLETE_ACCOUNT_DAYS),
    waitlistedBefore: daysBefore(now, FREE_WAITLIST_DAYS),
  };
}

export function withdrawalWindowStart(now: Date): Date {
  return daysBefore(now, WITHDRAWAL_DAYS);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const PROJECTLESS_GRACE_DAYS = 30;

export function projectlessDeletionThreshold(now: Date): Date {
  return new Date(now.getTime() - PROJECTLESS_GRACE_DAYS * DAY_MS);
}

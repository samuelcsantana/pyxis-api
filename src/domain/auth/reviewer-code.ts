export const MAX_REVIEWER_CODE_FAILURES = 20;
export const DEFAULT_REVIEWER_CODE_DAYS = 365;
export const MAX_REVIEWER_CODE_DAYS = 365;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function reviewerCodeExpiry(openedAt: Date, days: number): Date {
  return new Date(openedAt.getTime() + days * MILLISECONDS_PER_DAY);
}

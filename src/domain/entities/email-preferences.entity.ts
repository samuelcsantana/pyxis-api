import { ALERTS_BY_DEFAULT } from '../alerts/project-alert';

export const WEEKLY_DIGEST_BY_DEFAULT = true;

export interface EmailPreferences {
  readonly weeklyDigest: boolean;
  readonly noEventsAlert: boolean;
  readonly failedWritesAlert: boolean;
  readonly conversionDropAlert: boolean;
}

export type EmailPreferenceChanges = Partial<EmailPreferences>;

export const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
  weeklyDigest: WEEKLY_DIGEST_BY_DEFAULT,
  noEventsAlert: ALERTS_BY_DEFAULT,
  failedWritesAlert: ALERTS_BY_DEFAULT,
  conversionDropAlert: ALERTS_BY_DEFAULT,
};

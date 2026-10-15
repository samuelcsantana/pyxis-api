import type { EmailLanguage } from '../auth/email-language';
import type { AccountStatus } from './account-status';
import { eventsPerMonthOf, ingestionPauseThresholdOf } from './account-limits';

export interface AccountOwnerContact {
  readonly email: string;
  readonly language: EmailLanguage;
}

export interface AccountMonthUsage {
  readonly accountId: string;
  readonly status: AccountStatus;
  readonly events: number;
  readonly owner: AccountOwnerContact;
  readonly notifiedLevel: number;
  readonly pauseExemptUntil: Date | null;
  readonly eventsPerMonthLimit: number | null;
}

export function isPauseExemptAt(exemptUntil: Date | null, moment: Date): boolean {
  return exemptUntil !== null && exemptUntil.getTime() > moment.getTime();
}

export function ingestionPauseFor(
  usage: AccountMonthUsage,
  monthEnd: Date,
  measuredAt: Date,
): Date | null {
  if (usage.status === 'comped' || isPauseExemptAt(usage.pauseExemptUntil, measuredAt)) {
    return null;
  }
  const threshold = ingestionPauseThresholdOf(eventsPerMonthOf(usage.eventsPerMonthLimit));
  return usage.events >= threshold ? monthEnd : null;
}

export function isPausedAt(pausedUntil: Date | null, moment: Date): pausedUntil is Date {
  return pausedUntil !== null && pausedUntil.getTime() > moment.getTime();
}

import type { AccountStatus } from './account-status';
import { HOSTED_PLAN_LIMITS, INGESTION_PAUSE_RATIO } from './hosted-plan';

export interface AccountMonthUsage {
  readonly accountId: string;
  readonly status: AccountStatus;
  readonly events: number;
}

export const INGESTION_PAUSE_THRESHOLD = HOSTED_PLAN_LIMITS.eventsPerMonth * INGESTION_PAUSE_RATIO;

export function ingestionPauseFor(usage: AccountMonthUsage, monthEnd: Date): Date | null {
  if (usage.status === 'comped') {
    return null;
  }
  return usage.events >= INGESTION_PAUSE_THRESHOLD ? monthEnd : null;
}

export function isPausedAt(pausedUntil: Date | null, moment: Date): pausedUntil is Date {
  return pausedUntil !== null && pausedUntil.getTime() > moment.getTime();
}

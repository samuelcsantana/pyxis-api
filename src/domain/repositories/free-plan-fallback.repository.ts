import type { FreePlanFit } from '../accounts/free-plan-fallback';
import type { EmailLanguage } from '../auth/email-language';

export interface BackToFreeTarget {
  readonly accountId: string;
  readonly ownerEmail: string;
  readonly ownerLanguage: EmailLanguage;
  readonly eventsPerMonthLimit: number | null;
}

export interface FitDeadline {
  readonly accountId: string;
  readonly fit: FreePlanFit;
}

export interface FreePlanFallbackRepository {
  fitOf(accountId: string): Promise<FreePlanFit | null>;
  fallBack(accountId: string, at: Date): Promise<boolean>;
  toNotify(accountId: string): Promise<BackToFreeTarget | null>;
  pendingNotices(): Promise<readonly BackToFreeTarget[]>;
  markNotified(accountId: string): Promise<void>;
  fitDeadlinesDue(now: Date): Promise<readonly FitDeadline[]>;
  clearFitDeadline(accountId: string): Promise<void>;
  endUnfit(accountId: string, at: Date): Promise<void>;
}

export const FREE_PLAN_FALLBACK_REPOSITORY = Symbol('FreePlanFallbackRepository');

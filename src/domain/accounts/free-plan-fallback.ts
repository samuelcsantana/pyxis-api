import { type PlanLimitOverrides, planLimitsOf } from './account-limits';

const DAY_MS = 24 * 60 * 60 * 1000;
const TERMS_VERSION_PATTERN = /^(\d+)\.(\d+)$/;

export const FREE_PLAN_FIT_DAYS = 30;

export const FREE_PLAN_TERMS_VERSION = { major: 1, minor: 3 } as const;

export interface FreePlanFit extends PlanLimitOverrides {
  readonly projects: number;
  readonly people: number;
  readonly acceptedTermsVersions: readonly string[];
  readonly ownerHasAnotherFreeAccount: boolean;
}

export interface FreePlanFallbackPolicy {
  readonly freePlanOpen: boolean;
  readonly freePlanTermsForEarlierAccountsFrom: Date | null;
}

export function fitsFreePlan(fit: FreePlanFit): boolean {
  const limits = planLimitsOf({ ...fit, status: 'free' });
  return fit.projects <= limits.projects && fit.people <= limits.people;
}

export function isFreePlanTermsVersion(version: string): boolean {
  const match = TERMS_VERSION_PATTERN.exec(version);
  if (match === null) {
    return false;
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return (
    major > FREE_PLAN_TERMS_VERSION.major ||
    (major === FREE_PLAN_TERMS_VERSION.major && minor >= FREE_PLAN_TERMS_VERSION.minor)
  );
}

export function boundByFreePlanTerms(
  fit: FreePlanFit,
  policy: FreePlanFallbackPolicy,
  now: Date,
): boolean {
  if (fit.acceptedTermsVersions.some(isFreePlanTermsVersion)) {
    return true;
  }
  const earlierAccountsFrom = policy.freePlanTermsForEarlierAccountsFrom;
  return earlierAccountsFrom !== null && now.getTime() >= earlierAccountsFrom.getTime();
}

export function fallsBackToFree(
  fit: FreePlanFit,
  policy: FreePlanFallbackPolicy,
  now: Date,
): boolean {
  return (
    policy.freePlanOpen &&
    !fit.ownerHasAnotherFreeAccount &&
    boundByFreePlanTerms(fit, policy, now) &&
    fitsFreePlan(fit)
  );
}

export function freePlanFitDueAt(now: Date): Date {
  return new Date(now.getTime() + FREE_PLAN_FIT_DAYS * DAY_MS);
}

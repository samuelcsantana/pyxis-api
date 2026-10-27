import type { AccountStatus } from './account-status';
import {
  FREE_PLAN_LIMITS,
  FREE_PLAN_PAUSE_RATIO,
  HOSTED_PLAN_LIMITS,
  HOSTED_PLAN_PAUSE_RATIO,
} from './hosted-plan';

export interface PlanLimits {
  readonly eventsPerMonth: number;
  readonly projects: number;
  readonly people: number;
}

export interface PlanLimitOverrides {
  readonly eventsPerMonthLimit: number | null;
  readonly projectsLimit: number | null;
  readonly peopleLimit: number | null;
}

export interface PlanAccount extends PlanLimitOverrides {
  readonly status: AccountStatus;
}

export type MonthlyLimitOf = Pick<PlanAccount, 'status' | 'eventsPerMonthLimit'>;

export type PlanLimitChanges = Partial<PlanLimitOverrides>;

export interface PlanUsage {
  readonly events: number;
  readonly projects: number;
  readonly people: number;
}

export type PlanLimitName = keyof PlanLimits;

export interface ExceededLimit {
  readonly limit: PlanLimitName;
  readonly used: number;
  readonly allowed: number;
}

export const NO_LIMIT_OVERRIDES: PlanLimitOverrides = {
  eventsPerMonthLimit: null,
  projectsLimit: null,
  peopleLimit: null,
};

export const MAX_PLAN_LIMITS: PlanLimits = {
  eventsPerMonth: 100_000_000,
  projects: 100,
  people: 100,
};

export const RESET_LIMITS: PlanLimitChanges = NO_LIMIT_OVERRIDES;

const LIMIT_NAMES: readonly PlanLimitName[] = ['eventsPerMonth', 'projects', 'people'];

function isOnFreePlan(status: AccountStatus): boolean {
  return status === 'free';
}

function basePlanLimitsOf(status: AccountStatus): PlanLimits {
  return isOnFreePlan(status) ? FREE_PLAN_LIMITS : HOSTED_PLAN_LIMITS;
}

function ingestionPauseRatioOf(status: AccountStatus): number {
  return isOnFreePlan(status) ? FREE_PLAN_PAUSE_RATIO : HOSTED_PLAN_PAUSE_RATIO;
}

export function eventsPerMonthOf(account: MonthlyLimitOf): number {
  return account.eventsPerMonthLimit ?? basePlanLimitsOf(account.status).eventsPerMonth;
}

export function planLimitsOf(account: PlanAccount): PlanLimits {
  const base = basePlanLimitsOf(account.status);
  return {
    eventsPerMonth: eventsPerMonthOf(account),
    projects: account.projectsLimit ?? base.projects,
    people: account.peopleLimit ?? base.people,
  };
}

export function ingestionPauseThresholdOf(account: MonthlyLimitOf): number {
  return Math.ceil(eventsPerMonthOf(account) * ingestionPauseRatioOf(account.status));
}

export function exceededLimits(limits: PlanLimits, usage: PlanUsage): readonly ExceededLimit[] {
  const used: Readonly<Record<PlanLimitName, number>> = {
    eventsPerMonth: usage.events,
    projects: usage.projects,
    people: usage.people,
  };
  return LIMIT_NAMES.filter((name) => used[name] > limits[name]).map((name) => ({
    limit: name,
    used: used[name],
    allowed: limits[name],
  }));
}

import { HOSTED_PLAN_LIMITS, INGESTION_PAUSE_RATIO } from './hosted-plan';

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

export function eventsPerMonthOf(eventsPerMonthLimit: number | null): number {
  return eventsPerMonthLimit ?? HOSTED_PLAN_LIMITS.eventsPerMonth;
}

export function planLimitsOf(overrides: PlanLimitOverrides): PlanLimits {
  return {
    eventsPerMonth: eventsPerMonthOf(overrides.eventsPerMonthLimit),
    projects: overrides.projectsLimit ?? HOSTED_PLAN_LIMITS.projects,
    people: overrides.peopleLimit ?? HOSTED_PLAN_LIMITS.people,
  };
}

export function ingestionPauseThresholdOf(eventsPerMonth: number): number {
  return eventsPerMonth * INGESTION_PAUSE_RATIO;
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

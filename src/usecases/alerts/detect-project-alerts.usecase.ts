import { Inject, Injectable } from '@nestjs/common';
import {
  alertDays,
  type AlertDays,
  failureRate,
  isConversionDrop,
  isFailureSpike,
  isSilent,
} from '../../domain/alerts/alert-rules';
import type { AlertKind, ProjectAlert } from '../../domain/alerts/project-alert';
import type { Project } from '../../domain/entities/project.entity';
import { type Goal, inGoalOrder } from '../../domain/goals/goal';
import type { DateRange } from '../../domain/queries/date-range';
import {
  OVERVIEW_QUERY,
  type OverviewQuery,
  type PeriodTotals,
} from '../../domain/queries/overview';
import {
  NO_ACTIVITY,
  PROJECT_ACTIVITY_QUERY,
  type ProjectActivityQuery,
} from '../../domain/queries/project-activity';
import { NO_REPORT_FILTERS } from '../../domain/queries/report-filters';
import { GOAL_REPOSITORY, type GoalRepository } from '../../domain/repositories/goal.repository';

interface Measures {
  readonly project: Project;
  readonly days: AlertDays;
  readonly totalsOf: (range: DateRange) => Promise<PeriodTotals>;
  readonly firstGoal: Goal | null;
}

function oneDay(day: string): DateRange {
  return { from: day, to: day };
}

@Injectable()
export class DetectProjectAlertsUseCase {
  constructor(
    @Inject(OVERVIEW_QUERY) private readonly overview: OverviewQuery,
    @Inject(PROJECT_ACTIVITY_QUERY) private readonly activity: ProjectActivityQuery,
    @Inject(GOAL_REPOSITORY) private readonly goals: GoalRepository,
  ) {}

  async execute(
    project: Project,
    kinds: ReadonlySet<AlertKind>,
    now: Date,
  ): Promise<readonly ProjectAlert[]> {
    const firstGoal = kinds.has('conversion_drop')
      ? (inGoalOrder(await this.goals.listByProject(project.id))[0] ?? null)
      : null;
    const measures = this.measuresOf(project, firstGoal, now);
    const found = await Promise.all([
      kinds.has('no_events') ? this.noEvents(measures, now) : null,
      kinds.has('failed_writes') ? this.failedWrites(measures) : null,
      kinds.has('conversion_drop') ? this.conversionDrop(measures) : null,
    ]);
    return found.filter((alert) => alert !== null);
  }

  private measuresOf(project: Project, firstGoal: Goal | null, now: Date): Measures {
    const cache = new Map<string, Promise<PeriodTotals>>();
    const totalsOf = (range: DateRange): Promise<PeriodTotals> => {
      const key = `${range.from}:${range.to}`;
      const known = cache.get(key);
      if (known !== undefined) {
        return known;
      }
      const measured = this.overview.totals({
        projectId: project.id,
        timeZone: project.timezone,
        conversion: firstGoal === null ? null : firstGoal.target,
        range,
        filters: NO_REPORT_FILTERS,
      });
      cache.set(key, measured);
      return measured;
    };
    return { project, days: alertDays(project.timezone, now), totalsOf, firstGoal };
  }

  private async noEvents(measures: Measures, now: Date): Promise<ProjectAlert | null> {
    const { project } = measures;
    const [activity, history] = await Promise.all([
      this.activity.activityOf([project.id]),
      measures.totalsOf(measures.days.history),
    ]);
    const { lastEventAt } = activity.get(project.id) ?? NO_ACTIVITY;
    if (!isSilent(lastEventAt, history.visits, now)) {
      return null;
    }
    return {
      kind: 'no_events',
      projectId: project.id,
      projectName: project.name,
      timeZone: project.timezone,
      lastEventAt,
      visitsBefore: history.visits,
    };
  }

  private async failedWrites(measures: Measures): Promise<ProjectAlert | null> {
    const { project, days } = measures;
    const [day, usual] = await Promise.all([
      measures.totalsOf(oneDay(days.day)),
      measures.totalsOf(days.usual),
    ]);
    const dayCount = { failed: day.failedWrites, total: day.writes };
    const usualCount = { failed: usual.failedWrites, total: usual.writes };
    if (!isFailureSpike(dayCount, usualCount)) {
      return null;
    }
    return {
      kind: 'failed_writes',
      projectId: project.id,
      projectName: project.name,
      timeZone: project.timezone,
      day: days.day,
      ...dayCount,
      usualRate: failureRate(usualCount),
    };
  }

  private async conversionDrop(measures: Measures): Promise<ProjectAlert | null> {
    const { project, days, firstGoal } = measures;
    if (firstGoal === null) {
      return null;
    }
    const [day, compared] = await Promise.all([
      measures.totalsOf(oneDay(days.day)),
      measures.totalsOf(oneDay(days.comparedDay)),
    ]);
    if (!isConversionDrop(day.conversions, compared.conversions)) {
      return null;
    }
    return {
      kind: 'conversion_drop',
      projectId: project.id,
      projectName: project.name,
      timeZone: project.timezone,
      goalName: firstGoal.name,
      day: days.day,
      conversions: day.conversions,
      comparedDay: days.comparedDay,
      comparedConversions: compared.conversions,
    };
  }
}

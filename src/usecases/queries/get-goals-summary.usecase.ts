import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import type { Goal } from '../../domain/goals/goal';
import {
  GOALS_SUMMARY_QUERY,
  type GoalsSummaryQuery,
  type GoalsSummaryReport,
  goalsSummary,
} from '../../domain/queries/goals-summary';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { type RequestedRange, scopedPeriods } from './scoped-periods';

@Injectable()
export class GetGoalsSummaryUseCase {
  constructor(
    @Inject(GOALS_SUMMARY_QUERY) private readonly query: GoalsSummaryQuery,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(
    project: Project,
    goals: readonly Goal[],
    requested: RequestedRange,
  ): Promise<GoalsSummaryReport> {
    const { current } = scopedPeriods(project, requested, this.clock.now());
    return goalsSummary(goals, await this.query.countsInGoalOrder(current, goals));
  }
}

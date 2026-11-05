import type { Project } from '../../domain/entities/project.entity';
import type { Goal } from '../../domain/goals/goal';
import type { GoalsSummaryCounts, GoalsSummaryQuery } from '../../domain/queries/goals-summary';
import type { QueryScope } from '../../domain/queries/query-scope';
import { NO_REPORT_FILTERS } from '../../domain/queries/report-filters';
import { FixedClock } from '../../test-utils/fixed-clock';
import { GetGoalsSummaryUseCase } from './get-goals-summary.usecase';

const PROJECT: Project = {
  id: 'project-1',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: 'signup_completed',
  currency: 'BRL',
  cityEnabled: false,
  visitorsEnabled: false,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};

const SIGNUP: Goal = {
  id: 'goal-1',
  projectId: PROJECT.id,
  name: 'Signed up',
  target: { type: 'event', name: 'signup_completed' },
  position: 1,
  createdAt: new Date('2026-11-04T12:00:00.000Z'),
};

class RecordingGoalsSummaryQuery implements GoalsSummaryQuery {
  readonly asked: { scope: QueryScope; goals: readonly Goal[] }[] = [];

  countsInGoalOrder(scope: QueryScope, goals: readonly Goal[]): Promise<GoalsSummaryCounts> {
    this.asked.push({ scope, goals });
    return Promise.resolve({ visits: 8, conversions: [3], convertingVisits: [2] });
  }
}

describe('GetGoalsSummaryUseCase', () => {
  it('counts every goal over the range and filters of the project', async () => {
    const query = new RecordingGoalsSummaryQuery();
    const useCase = new GetGoalsSummaryUseCase(
      query,
      new FixedClock(new Date('2026-11-04T15:00:00.000Z')),
    );

    const report = await useCase.execute(PROJECT, [SIGNUP], {
      from: '2026-11-01',
      to: '2026-11-04',
    });

    expect(report).toEqual({
      visits: 8,
      goals: [{ goal: SIGNUP, conversions: 3, convertingVisits: 2, conversionRate: 0.25 }],
    });
    expect(query.asked).toEqual([
      {
        scope: {
          projectId: PROJECT.id,
          timeZone: 'America/Sao_Paulo',
          conversion: null,
          range: { from: '2026-11-01', to: '2026-11-04' },
          filters: NO_REPORT_FILTERS,
        },
        goals: [SIGNUP],
      },
    ]);
  });
});

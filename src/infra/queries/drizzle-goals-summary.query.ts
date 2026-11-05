import { Inject, Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';
import type { Goal } from '../../domain/goals/goal';
import type { GoalsSummaryCounts, GoalsSummaryQuery } from '../../domain/queries/goals-summary';
import type { QueryScope } from '../../domain/queries/query-scope';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { events } from '../database/schema/events';
import { matchesGoal, visits } from './definitions';
import { inScope } from './report-filters';

function countsPerGoal(goals: readonly Goal[], count: (goal: Goal) => SQL): SQL {
  return sql`jsonb_build_array(${sql.join(goals.map(count), sql`, `)})`;
}

@Injectable()
export class DrizzleGoalsSummaryQuery implements GoalsSummaryQuery {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async countsInGoalOrder(scope: QueryScope, goals: readonly Goal[]): Promise<GoalsSummaryCounts> {
    const rows = await this.db.execute<{
      visits: number;
      conversions: number[];
      convertingVisits: number[];
    }>(sql`
      SELECT ${visits} AS "visits",
        ${countsPerGoal(goals, (goal) => sql`count(*) FILTER (WHERE ${matchesGoal(goal.target)})::int`)}
          AS "conversions",
        ${countsPerGoal(
          goals,
          (goal) =>
            sql`count(DISTINCT ${events.sessionId}) FILTER (WHERE ${matchesGoal(goal.target)})::int`,
        )} AS "convertingVisits"
      FROM ${events}
      WHERE ${inScope(scope)}`);
    const [aggregate] = rows as unknown as readonly [GoalsSummaryCounts];
    return aggregate;
  }
}

import { Controller, Get, HttpStatus, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { GetGoalsSummaryUseCase } from '../../../usecases/queries/get-goals-summary.usecase';
import { ReadAccess } from '../auth/read-access.decorator';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { ApiAccountSuspended } from '../errors/account-suspended.response';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { goalsOf, ProjectAccessGuard, projectOf } from '../queries/project-access.guard';
import { ApiRange } from '../queries/queries.controller';
import { type FilteredRangeQuery, filteredRangeQuerySchema } from '../queries/query.schemas';
import { ApiReportFilters, filteredRangeOf } from '../queries/report-filter-params';
import { SchemaPipe } from '../schema-pipe';
import {
  goalBody,
  type GoalListBody,
  goalListSchema,
  type GoalsSummaryBody,
  goalsSummaryBody,
  goalsSummarySchema,
} from './goals.schemas';

@ApiTags('goals')
@ApiCookieAuth(SESSION_COOKIE_NAME)
@ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
@ApiResponse({
  status: HttpStatus.NOT_FOUND,
  description:
    'The project does not exist or the admin may not read it, or a goal id is not one of its ' +
    'goals (goal_not_found).',
  standardSchema: errorResponseSchema,
})
@ApiParam({ name: 'projectId', schema: { type: 'string', format: 'uuid' } })
@ApiAccountSuspended()
@Controller('v1/projects/:projectId/goals')
@ReadAccess(ProjectAccessGuard)
export class GoalsController {
  constructor(private readonly getGoalsSummary: GetGoalsSummaryUseCase) {}

  @Get()
  @ApiOperation({ summary: 'The goals of the project, in order' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: goalListSchema })
  list(@Req() request: FastifyRequest): GoalListBody {
    return { goals: goalsOf(request).map(goalBody) };
  }

  @Get('summary')
  @ApiRange()
  @ApiReportFilters()
  @ApiOperation({ summary: 'The conversions and conversion rate of each goal in a range' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: goalsSummarySchema })
  async summary(
    @Req() request: FastifyRequest,
    @Query({ schema: filteredRangeQuerySchema, pipes: [new SchemaPipe(filteredRangeQuerySchema)] })
    query: FilteredRangeQuery,
  ): Promise<GoalsSummaryBody> {
    const goals = goalsOf(request);
    return goalsSummaryBody(
      await this.getGoalsSummary.execute(projectOf(request), goals, filteredRangeOf(query, goals)),
    );
  }
}

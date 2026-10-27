import { Controller, Get, HttpStatus, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { GetTimeOfDayUseCase } from '../../../usecases/queries/get-time-of-day.usecase';
import { ReadAccess } from '../auth/read-access.decorator';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { SchemaPipe } from '../schema-pipe';
import { ProjectAccessGuard, projectOf } from './project-access.guard';
import { ApiRange } from './queries.controller';
import { type FilteredRangeQuery, filteredRangeQuerySchema } from './query.schemas';
import { ApiReportFilters, filteredRangeOf } from './report-filter-params';
import { type TimeOfDayReportBody, timeOfDayReportSchema } from './time-of-day.schemas';
import { ApiAccountSuspended } from '../errors/account-suspended.response';

@ApiTags('dashboard queries')
@ApiCookieAuth(SESSION_COOKIE_NAME)
@ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
@ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
@ApiResponse({
  status: HttpStatus.NOT_FOUND,
  description: 'The project does not exist or the admin may not read it; the answer is the same.',
  standardSchema: errorResponseSchema,
})
@ApiParam({ name: 'projectId', schema: { type: 'string', format: 'uuid' } })
@ApiAccountSuspended()
@Controller('v1/projects/:projectId')
@ReadAccess(ProjectAccessGuard)
export class TimeOfDayController {
  constructor(private readonly getTimeOfDay: GetTimeOfDayUseCase) {}

  @Get('time-of-day')
  @ApiRange()
  @ApiReportFilters()
  @ApiOperation({ summary: 'The visits of the range by the weekday and local hour they started' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: timeOfDayReportSchema })
  async timeOfDay(
    @Req() request: FastifyRequest,
    @Query({ schema: filteredRangeQuerySchema, pipes: [new SchemaPipe(filteredRangeQuerySchema)] })
    query: FilteredRangeQuery,
  ): Promise<TimeOfDayReportBody> {
    const weekdays = await this.getTimeOfDay.execute(projectOf(request), filteredRangeOf(query));
    return { weekdays: weekdays.map((day) => ({ weekday: day.weekday, hours: [...day.hours] })) };
  }
}

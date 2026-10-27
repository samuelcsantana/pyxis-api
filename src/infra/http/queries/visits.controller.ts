import { Controller, Get, HttpStatus, Query, Req } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import type { VisitFilters, VisitsReport } from '../../../domain/queries/visits';
import { GetVisitsUseCase } from '../../../usecases/queries/get-visits.usecase';
import { ReadAccess } from '../auth/read-access.decorator';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { SchemaPipe } from '../schema-pipe';
import { ProjectAccessGuard, projectOf } from './project-access.guard';
import { ApiReportFilters, reportFiltersOf } from './report-filter-params';
import {
  visitCursorText,
  type VisitsQueryParams,
  visitsQuerySchema,
  type VisitsReportBody,
  visitsReportSchema,
} from './visits.schemas';
import { ApiAccountSuspended } from '../errors/account-suspended.response';

function visitFilters(query: VisitsQueryParams): VisitFilters {
  return { ...reportFiltersOf(query), route: query.route ?? null };
}

function visitsBody(report: VisitsReport, timezone: string): VisitsReportBody {
  return {
    visits: report.visits.map((visit) => ({
      session_id: visit.sessionId,
      started_at: visit.startedAt.toISOString(),
      ended_at: visit.endedAt.toISOString(),
      entry_path: visit.entryPath,
      page_views: visit.pageViews,
      highlights: [...visit.highlights],
      failed_requests: visit.failedRequests,
      device_type: visit.deviceType,
      browser: visit.browser,
      os: visit.os,
      country: visit.country,
      region: visit.region,
      region_name: visit.regionName,
      channel: visit.channel,
      source: visit.source,
      campaign: visit.campaign,
      user_id: visit.userId,
    })),
    next_cursor: report.nextCursor === null ? null : visitCursorText(report.nextCursor),
    total: report.total,
    timezone,
  };
}

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
export class VisitsController {
  constructor(private readonly getVisits: GetVisitsUseCase) {}

  @Get('visits')
  @ApiOperation({ summary: 'The visits of a range, newest first, filtered by what they did' })
  @ApiQuery({
    name: 'from',
    description: 'First day, inclusive, in the project time zone',
    schema: { type: 'string', format: 'date' },
  })
  @ApiQuery({
    name: 'to',
    description: 'Last day, inclusive, at most today in the project time zone; 400 days at most',
    schema: { type: 'string', format: 'date' },
  })
  @ApiReportFilters()
  @ApiQuery({
    name: 'route',
    required: false,
    description:
      'Only the visits that made this request, as method and route: POST /orders/:id; with ' +
      'failed=true, only those where a call to it failed',
    schema: { type: 'string' },
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'The next_cursor of the previous page',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: visitsReportSchema })
  async visits(
    @Req() request: FastifyRequest,
    @Query({ schema: visitsQuerySchema, pipes: [new SchemaPipe(visitsQuerySchema)] })
    query: VisitsQueryParams,
  ): Promise<VisitsReportBody> {
    const project = projectOf(request);
    const range = { from: query.from, to: query.to };
    const report = await this.getVisits.execute(
      project,
      range,
      visitFilters(query),
      query.cursor ?? null,
    );
    return visitsBody(report, project.timezone);
  }
}

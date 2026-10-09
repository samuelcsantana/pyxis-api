import { Controller, Get, HttpStatus, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import type { EngagementReport } from '../../../domain/queries/engagement';
import { GetEngagementUseCase } from '../../../usecases/queries/get-engagement.usecase';
import { SessionGuard } from '../auth/auth.guards';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { SchemaPipe } from '../schema-pipe';
import { type EngagementReportBody, engagementReportSchema } from './engagement.schemas';
import { ProjectAccessGuard, projectOf } from './project-access.guard';
import { ApiRange } from './queries.controller';
import { type RangeQuery, rangeQuerySchema } from './query.schemas';

export function engagementBody(report: EngagementReport): EngagementReportBody {
  return {
    visits: report.visits,
    single_page_visits: report.singlePageVisits,
    median_visit_seconds: report.medianVisitSeconds,
    visit_lengths: report.visitLengths.map((bucket) => ({
      up_to_seconds: bucket.upToSeconds,
      visits: bucket.visits,
    })),
    entry_pages: report.entryPages.map((page) => ({
      path: page.path,
      visits: page.visits,
      single_page_visits: page.singlePageVisits,
    })),
    exit_pages: report.exitPages.map((page) => ({ path: page.path, visits: page.visits })),
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
@Controller('v1/projects/:projectId')
@UseGuards(SessionGuard, ProjectAccessGuard)
export class EngagementController {
  constructor(private readonly getEngagement: GetEngagementUseCase) {}

  @Get('engagement')
  @ApiRange()
  @ApiOperation({ summary: 'Entry and exit pages, single-page visits and visit length' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: engagementReportSchema })
  async engagement(
    @Req() request: FastifyRequest,
    @Query({ schema: rangeQuerySchema, pipes: [new SchemaPipe(rangeQuerySchema)] })
    range: RangeQuery,
  ): Promise<EngagementReportBody> {
    return engagementBody(await this.getEngagement.execute(projectOf(request), range));
  }
}

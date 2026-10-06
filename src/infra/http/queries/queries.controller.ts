import { Controller, Get, HttpStatus, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import type { Kpi, OverviewReport, WriteErrorsKpi } from '../../../domain/queries/overview';
import { GetOverviewUseCase } from '../../../usecases/queries/get-overview.usecase';
import { SessionGuard } from '../auth/auth.guards';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { SchemaPipe } from '../schema-pipe';
import { ProjectAccessGuard, projectOf } from './project-access.guard';
import {
  type OverviewReportBody,
  overviewReportSchema,
  type RangeQuery,
  rangeQuerySchema,
} from './query.schemas';

function kpiBody(kpi: Kpi) {
  return { current: kpi.current, previous: kpi.previous, daily: [...kpi.daily] };
}

function writeErrorsBody(kpi: WriteErrorsKpi) {
  return { current: kpi.current, previous: kpi.previous, daily: [...kpi.daily] };
}

function overviewBody(report: OverviewReport): OverviewReportBody {
  const { conversions } = report.kpis;
  return {
    kpis: {
      visits: kpiBody(report.kpis.visits),
      identified_users: kpiBody(report.kpis.identifiedUsers),
      conversions: conversions === null ? null : kpiBody(conversions),
      write_errors: writeErrorsBody(report.kpis.writeErrors),
    },
    days: report.days.map((day) => ({
      date: day.date,
      page_views: day.pageViews,
      events: day.events,
    })),
    top_pages: [...report.topPages],
    top_events: [...report.topEvents],
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
@Controller('v1/projects/:projectId')
@UseGuards(SessionGuard, ProjectAccessGuard)
export class QueriesController {
  constructor(private readonly getOverview: GetOverviewUseCase) {}

  @Get('overview')
  @ApiOperation({ summary: 'KPIs, daily activity, top pages and top events of a range' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: overviewReportSchema })
  async overview(
    @Req() request: FastifyRequest,
    @Query({ schema: rangeQuerySchema, pipes: [new SchemaPipe(rangeQuerySchema)] })
    range: RangeQuery,
  ): Promise<OverviewReportBody> {
    return overviewBody(await this.getOverview.execute(projectOf(request), range));
  }
}

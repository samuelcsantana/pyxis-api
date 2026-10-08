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
import { CHANNELS, DEVICE_TYPES } from '../../../domain/entities/tracked-event.entity';
import {
  MAX_REFERRER_HOST_LENGTH,
  MAX_UTM_VALUE_LENGTH,
} from '../../../domain/events/event-limits';
import {
  MAX_VISIT_PATH_FILTERS,
  VISIT_IDENTITIES,
  type VisitFilters,
  type VisitsReport,
} from '../../../domain/queries/visits';
import { GetVisitsUseCase } from '../../../usecases/queries/get-visits.usecase';
import { SessionGuard } from '../auth/auth.guards';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { SchemaPipe } from '../schema-pipe';
import { ProjectAccessGuard, projectOf } from './project-access.guard';
import {
  visitCursorText,
  type VisitsQueryParams,
  visitsQuerySchema,
  type VisitsReportBody,
  visitsReportSchema,
} from './visits.schemas';

function visitFilters(query: VisitsQueryParams): VisitFilters {
  return {
    paths: query.path ?? [],
    event:
      query.event === undefined ? null : { name: query.event, property: query.property ?? null },
    channel: query.channel ?? null,
    deviceType: query.device ?? null,
    identity: query.identity ?? null,
    country: query.country ?? null,
    source: query.source ?? null,
    campaign: query.campaign ?? null,
    route: query.route ?? null,
    failed: query.failed ?? false,
  };
}

function visitsBody(report: VisitsReport): VisitsReportBody {
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
      channel: visit.channel,
      source: visit.source,
      campaign: visit.campaign,
      user_id: visit.userId,
    })),
    next_cursor: report.nextCursor === null ? null : visitCursorText(report.nextCursor),
    total: report.total,
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
  @ApiQuery({
    name: 'path',
    required: false,
    description:
      `A page the visit viewed; a star matches any characters. Repeat it, up to ` +
      `${String(MAX_VISIT_PATH_FILTERS)} times, for visits that viewed every one`,
    schema: { type: 'array', items: { type: 'string' }, maxItems: MAX_VISIT_PATH_FILTERS },
  })
  @ApiQuery({
    name: 'event',
    required: false,
    description: 'A named event the visit sent',
    schema: { type: 'string' },
  })
  @ApiQuery({
    name: 'property',
    required: false,
    description: 'key=value: the event above carried this property value; needs event',
    schema: { type: 'string' },
  })
  @ApiQuery({ name: 'channel', required: false, enum: CHANNELS })
  @ApiQuery({ name: 'device', required: false, enum: DEVICE_TYPES })
  @ApiQuery({ name: 'identity', required: false, enum: VISIT_IDENTITIES })
  @ApiQuery({
    name: 'country',
    required: false,
    description: 'The two-letter country code of the visit',
    schema: { type: 'string', pattern: '^[A-Z]{2}$' },
  })
  @ApiQuery({
    name: 'source',
    required: false,
    description:
      'The source of the visit as Acquisition names it: campaign source, referring host or (direct)',
    schema: { type: 'string', maxLength: MAX_REFERRER_HOST_LENGTH },
  })
  @ApiQuery({
    name: 'campaign',
    required: false,
    description: 'The campaign (utm_campaign) of the visit entry',
    schema: { type: 'string', maxLength: MAX_UTM_VALUE_LENGTH },
  })
  @ApiQuery({
    name: 'route',
    required: false,
    description: 'A request the visit made, as method and route: POST /orders/:id',
    schema: { type: 'string' },
  })
  @ApiQuery({
    name: 'failed',
    required: false,
    description:
      'true: the visit had a failed request (status 0 or 400 and above); with route, on that route',
    schema: { type: 'string', enum: ['true', 'false'] },
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
    const range = { from: query.from, to: query.to };
    const report = await this.getVisits.execute(
      projectOf(request),
      range,
      visitFilters(query),
      query.cursor ?? null,
    );
    return visitsBody(report);
  }
}

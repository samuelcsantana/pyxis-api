import {
  applyDecorators,
  Controller,
  Get,
  HttpStatus,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import type { AcquisitionReport } from '../../../domain/queries/acquisition';
import type { DevicesReport, ValueShare } from '../../../domain/queries/devices';
import type { FeaturesReport } from '../../../domain/queries/features';
import type { RequestsReport } from '../../../domain/queries/requests';
import type { TimelineReport, TimelineSubject } from '../../../domain/queries/timeline';
import type { Kpi, OverviewReport, WriteErrorsKpi } from '../../../domain/queries/overview';
import { GetAcquisitionUseCase } from '../../../usecases/queries/get-acquisition.usecase';
import { GetDevicesUseCase } from '../../../usecases/queries/get-devices.usecase';
import { GetFeaturesUseCase } from '../../../usecases/queries/get-features.usecase';
import { GetFunnelUseCase } from '../../../usecases/queries/get-funnel.usecase';
import { GetRequestsUseCase } from '../../../usecases/queries/get-requests.usecase';
import { GetTimelineUseCase } from '../../../usecases/queries/get-timeline.usecase';
import { GetOverviewUseCase } from '../../../usecases/queries/get-overview.usecase';
import { SessionGuard } from '../auth/auth.guards';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { SchemaPipe } from '../schema-pipe';
import { ProjectAccessGuard, projectOf } from './project-access.guard';
import {
  type AcquisitionReportBody,
  acquisitionReportSchema,
  type DevicesReportBody,
  devicesReportSchema,
  type FeaturesQuery,
  featuresQuerySchema,
  type FeaturesReportBody,
  featuresReportSchema,
  type FunnelQuery,
  funnelQuerySchema,
  type FunnelReportBody,
  funnelReportSchema,
  type OverviewReportBody,
  overviewReportSchema,
  type RangeQuery,
  rangeQuerySchema,
  type RequestsQuery,
  requestsQuerySchema,
  type RequestsReportBody,
  requestsReportSchema,
  type TimelineQuery,
  timelineQuerySchema,
  type TimelineReportBody,
  timelineReportSchema,
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
    comparison_cutoff: report.comparisonCutoff,
    previous_days: report.previousDays.map((day) => ({
      date: day.date,
      page_views: day.pageViews,
      events: day.events,
      visits: day.visits,
      identified_users: day.identifiedUsers,
      conversions: day.conversions,
      write_errors: { ...day.writeErrors },
    })),
  };
}

function sharesBody(shares: readonly ValueShare[]) {
  return shares.map((share) => ({ ...share }));
}

function devicesBody(report: DevicesReport): DevicesReportBody {
  return {
    device_types: sharesBody(report.deviceType),
    browsers: sharesBody(report.browser),
    operating_systems: sharesBody(report.os),
    countries: sharesBody(report.country),
  };
}

function acquisitionBody(report: AcquisitionReport): AcquisitionReportBody {
  return {
    days: report.days.map((day) => ({ date: day.date, by_channel: { ...day.byChannel } })),
    sources: report.sources.map((source) => ({
      source: source.source,
      medium: source.medium,
      channel: source.channel,
      visits: source.visits,
      conversions: source.conversions,
      from_ad_click_visits: source.fromAdClickVisits,
    })),
  };
}

function featuresBody(report: FeaturesReport): FeaturesReportBody {
  return { items: report.items.map((item) => ({ ...item, daily: [...item.daily] })) };
}

function requestsBody(report: RequestsReport): RequestsReportBody {
  return {
    routes: report.routes.map((route) => ({
      method: route.method,
      route: route.route,
      total: route.total,
      failed: route.failed,
      statuses: route.statuses.map((entry) => ({ ...entry })),
      median_duration_ms: route.medianDurationMs,
      screens: route.screens.map((entry) => ({ ...entry })),
      recent_failures: route.recentFailures.map((failure) => ({
        occurred_at: failure.occurredAt.toISOString(),
        status: failure.status,
        error_code: failure.errorCode,
        session_id: failure.sessionId,
      })),
    })),
  };
}

export function ApiRange() {
  return applyDecorators(
    ApiQuery({
      name: 'from',
      description: 'First day, inclusive, in the project time zone',
      schema: { type: 'string', format: 'date' },
    }),
    ApiQuery({
      name: 'to',
      description: 'Last day, inclusive, at most today in the project time zone; 400 days at most',
      schema: { type: 'string', format: 'date' },
    }),
  );
}

function timelineBody(report: TimelineReport): TimelineReportBody {
  return {
    visits: report.visits.map((visit) => ({
      session_id: visit.sessionId,
      started_at: visit.startedAt.toISOString(),
      ended_at: visit.endedAt.toISOString(),
      device_type: visit.deviceType,
      browser: visit.browser,
      os: visit.os,
      country: visit.country,
      channel: visit.channel,
      events: visit.events.map((event) => ({
        id: event.id,
        occurred_at: event.occurredAt.toISOString(),
        name: event.name,
        path: event.path,
        properties: { ...event.properties },
      })),
    })),
    next_before: report.nextBefore === null ? null : report.nextBefore.toISOString(),
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
export class QueriesController {
  constructor(
    private readonly getOverview: GetOverviewUseCase,
    private readonly getDevices: GetDevicesUseCase,
    private readonly getAcquisition: GetAcquisitionUseCase,
    private readonly getFeatures: GetFeaturesUseCase,
    private readonly getRequests: GetRequestsUseCase,
    private readonly getFunnel: GetFunnelUseCase,
    private readonly getTimeline: GetTimelineUseCase,
  ) {}

  @Get('overview')
  @ApiRange()
  @ApiOperation({ summary: 'KPIs, daily activity, top pages and top events of a range' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: overviewReportSchema })
  async overview(
    @Req() request: FastifyRequest,
    @Query({ schema: rangeQuerySchema, pipes: [new SchemaPipe(rangeQuerySchema)] })
    range: RangeQuery,
  ): Promise<OverviewReportBody> {
    return overviewBody(await this.getOverview.execute(projectOf(request), range));
  }

  @Get('devices')
  @ApiRange()
  @ApiOperation({ summary: 'Visits and conversions by device type, browser, system and country' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: devicesReportSchema })
  async devices(
    @Req() request: FastifyRequest,
    @Query({ schema: rangeQuerySchema, pipes: [new SchemaPipe(rangeQuerySchema)] })
    range: RangeQuery,
  ): Promise<DevicesReportBody> {
    return devicesBody(await this.getDevices.execute(projectOf(request), range));
  }

  @Get('acquisition')
  @ApiRange()
  @ApiOperation({ summary: 'Visits per day and channel, and the sources that brought them' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: acquisitionReportSchema })
  async acquisition(
    @Req() request: FastifyRequest,
    @Query({ schema: rangeQuerySchema, pipes: [new SchemaPipe(rangeQuerySchema)] })
    range: RangeQuery,
  ): Promise<AcquisitionReportBody> {
    return acquisitionBody(await this.getAcquisition.execute(projectOf(request), range));
  }

  @Get('features')
  @ApiRange()
  @ApiOperation({ summary: 'The most used named events or screens, with their daily counts' })
  @ApiQuery({ name: 'kind', enum: ['events', 'screens'] })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: featuresReportSchema })
  async features(
    @Req() request: FastifyRequest,
    @Query({ schema: featuresQuerySchema, pipes: [new SchemaPipe(featuresQuerySchema)] })
    query: FeaturesQuery,
  ): Promise<FeaturesReportBody> {
    const range = { from: query.from, to: query.to };
    return featuresBody(await this.getFeatures.execute(projectOf(request), range, query.kind));
  }

  @Get('requests')
  @ApiRange()
  @ApiOperation({ summary: 'Writes per route: failures, statuses, durations and screens' })
  @ApiQuery({
    name: 'screen',
    required: false,
    description: 'Only the calls made from this page path',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: requestsReportSchema })
  async requests(
    @Req() request: FastifyRequest,
    @Query({ schema: requestsQuerySchema, pipes: [new SchemaPipe(requestsQuerySchema)] })
    query: RequestsQuery,
  ): Promise<RequestsReportBody> {
    const range = { from: query.from, to: query.to };
    const report = await this.getRequests.execute(projectOf(request), range, query.screen ?? null);
    return requestsBody(report);
  }

  @Get('funnel')
  @ApiRange()
  @ApiOperation({ summary: 'How many visits or people reached each step of a funnel, in order' })
  @ApiQuery({ name: 'mode', enum: ['visit', 'user'] })
  @ApiQuery({
    name: 'steps',
    description:
      'URL-encoded JSON array of 2 to 8 steps: {"type":"page","path":"/calculator-*"} (a star ' +
      'matches any characters) or {"type":"event","name":"signup_completed"}',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: funnelReportSchema })
  async funnel(
    @Req() request: FastifyRequest,
    @Query({ schema: funnelQuerySchema, pipes: [new SchemaPipe(funnelQuerySchema)] })
    query: FunnelQuery,
  ): Promise<FunnelReportBody> {
    const range = { from: query.from, to: query.to };
    const report = await this.getFunnel.execute(projectOf(request), range, query.mode, query.steps);
    return { steps: report.steps.map((step) => ({ count: step.count })) };
  }

  @Get('timeline')
  @ApiOperation({ summary: 'The visits of a person or of one visit, with every event' })
  @ApiQuery({ name: 'user_id', required: false, schema: { type: 'string' } })
  @ApiQuery({ name: 'session_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({
    name: 'before',
    required: false,
    description: 'The next_before of the previous page',
    schema: { type: 'string', format: 'date-time' },
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: timelineReportSchema })
  async timeline(
    @Req() request: FastifyRequest,
    @Query({ schema: timelineQuerySchema, pipes: [new SchemaPipe(timelineQuerySchema)] })
    query: TimelineQuery,
  ): Promise<TimelineReportBody> {
    const subject: TimelineSubject =
      'user_id' in query ? { userId: query.user_id } : { sessionId: query.session_id };
    const before = query.before === undefined ? null : new Date(query.before);
    return timelineBody(await this.getTimeline.execute(projectOf(request), subject, before));
  }
}

import { Controller, Get, HttpStatus, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { FUNNEL_SEGMENT_DIMENSIONS } from '../../../domain/queries/funnel';
import { SHARE_TOKEN_PATTERN } from '../../../domain/share-links/share-link';
import { GetAcquisitionUseCase } from '../../../usecases/queries/get-acquisition.usecase';
import { GetDevicesUseCase } from '../../../usecases/queries/get-devices.usecase';
import { GetEngagementUseCase } from '../../../usecases/queries/get-engagement.usecase';
import { GetFeaturesUseCase } from '../../../usecases/queries/get-features.usecase';
import { GetFunnelSegmentsUseCase } from '../../../usecases/queries/get-funnel-segments.usecase';
import { GetFunnelUseCase } from '../../../usecases/queries/get-funnel.usecase';
import { GetGoalsSummaryUseCase } from '../../../usecases/queries/get-goals-summary.usecase';
import { GetOverviewUseCase } from '../../../usecases/queries/get-overview.usecase';
import { GetTimeOfDayUseCase } from '../../../usecases/queries/get-time-of-day.usecase';
import {
  type GoalsSummaryBody,
  goalsSummaryBody,
  goalsSummarySchema,
} from '../goals/goals.schemas';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { engagementBody } from '../queries/engagement.controller';
import { type EngagementReportBody, engagementReportSchema } from '../queries/engagement.schemas';
import { funnelSegmentsBody } from '../queries/funnel-segments.controller';
import {
  type FunnelSegmentsReportBody,
  funnelSegmentsReportSchema,
} from '../queries/funnel-segments.schemas';
import { goalsOf, projectOf } from '../queries/project-access.guard';
import {
  acquisitionBody,
  ApiRange,
  devicesBody,
  featuresBody,
  funnelBody,
  overviewBody,
} from '../queries/queries.controller';
import {
  type AcquisitionReportBody,
  acquisitionReportSchema,
  type DevicesReportBody,
  devicesReportSchema,
  type FeaturesReportBody,
  featuresReportSchema,
  type FunnelReportBody,
  funnelReportSchema,
  type OverviewReportBody,
  overviewReportSchema,
} from '../queries/query.schemas';
import { ApiGoal, ApiReportFilters, filteredRangeOf } from '../queries/report-filter-params';
import { timeOfDayBody } from '../queries/time-of-day.controller';
import { type TimeOfDayReportBody, timeOfDayReportSchema } from '../queries/time-of-day.schemas';
import { ClientAddressThrottlerGuard } from '../rate-limit/client-address-throttler.guard';
import { SHARED_REPORTS_THROTTLER, skipThrottlersExcept } from '../rate-limit/rate-limits';
import { SchemaPipe } from '../schema-pipe';
import { ShareLinkGuard, shareLinkOf } from './share-link.guard';
import {
  FILTERS_NOT_SHARED,
  type SharedConversionRangeQuery,
  sharedConversionRangeQuerySchema,
  type SharedFeaturesQuery,
  sharedFeaturesQuerySchema,
  type SharedFilteredRangeQuery,
  sharedFilteredRangeQuerySchema,
  type SharedFunnelQuery,
  sharedFunnelQuerySchema,
  type SharedFunnelSegmentsQuery,
  sharedFunnelSegmentsQuerySchema,
} from './shared-query.schemas';
import {
  type SharedProjectBody,
  sharedProjectBody,
  sharedProjectSchema,
} from './share-links.schemas';

@ApiTags('shared reports')
@ApiParam({
  name: 'token',
  description: 'The token answered when the link was created',
  schema: { type: 'string', pattern: SHARE_TOKEN_PATTERN.source },
})
@ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
@ApiResponse({
  status: HttpStatus.NOT_FOUND,
  description:
    'No open link has this token: never issued, revoked, expired, or its account is no longer ' +
    'on Pro or is suspended (share_link_not_found). The answer never says which.',
  standardSchema: errorResponseSchema,
})
@ApiResponse({
  status: HttpStatus.TOO_MANY_REQUESTS,
  description: 'This address read shared reports too often; Retry-After says when to come back.',
  standardSchema: errorResponseSchema,
})
@Controller('v1/shared/:token')
@SkipThrottle(skipThrottlersExcept(SHARED_REPORTS_THROTTLER))
@UseGuards(ClientAddressThrottlerGuard, ShareLinkGuard)
export class SharedReportsController {
  constructor(
    private readonly getOverview: GetOverviewUseCase,
    private readonly getTimeOfDay: GetTimeOfDayUseCase,
    private readonly getGoalsSummary: GetGoalsSummaryUseCase,
    private readonly getAcquisition: GetAcquisitionUseCase,
    private readonly getDevices: GetDevicesUseCase,
    private readonly getFeatures: GetFeaturesUseCase,
    private readonly getEngagement: GetEngagementUseCase,
    private readonly getFunnel: GetFunnelUseCase,
    private readonly getFunnelSegments: GetFunnelSegmentsUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'The project a share link opens, with its goals',
    description: 'No session: the token is the credential. Only aggregate reports are shared.',
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: sharedProjectSchema })
  project(@Req() request: FastifyRequest): SharedProjectBody {
    return sharedProjectBody(shareLinkOf(request), projectOf(request), goalsOf(request));
  }

  @Get('overview')
  @ApiRange()
  @ApiReportFilters(...FILTERS_NOT_SHARED)
  @ApiGoal()
  @ApiOperation({ summary: 'The overview of the shared project, as GET /overview answers it' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: overviewReportSchema })
  async overview(
    @Req() request: FastifyRequest,
    @Query({
      schema: sharedConversionRangeQuerySchema,
      pipes: [new SchemaPipe(sharedConversionRangeQuerySchema)],
    })
    query: SharedConversionRangeQuery,
  ): Promise<OverviewReportBody> {
    return overviewBody(
      await this.getOverview.execute(projectOf(request), filteredRangeOf(query, goalsOf(request))),
    );
  }

  @Get('time-of-day')
  @ApiRange()
  @ApiReportFilters(...FILTERS_NOT_SHARED)
  @ApiOperation({ summary: 'The visits of the shared project by weekday and local hour' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: timeOfDayReportSchema })
  async timeOfDay(
    @Req() request: FastifyRequest,
    @Query({
      schema: sharedFilteredRangeQuerySchema,
      pipes: [new SchemaPipe(sharedFilteredRangeQuerySchema)],
    })
    query: SharedFilteredRangeQuery,
  ): Promise<TimeOfDayReportBody> {
    return timeOfDayBody(
      await this.getTimeOfDay.execute(projectOf(request), filteredRangeOf(query, goalsOf(request))),
    );
  }

  @Get('goals/summary')
  @ApiRange()
  @ApiReportFilters(...FILTERS_NOT_SHARED)
  @ApiOperation({ summary: 'The conversions and conversion rate of each goal of the project' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: goalsSummarySchema })
  async goalsSummary(
    @Req() request: FastifyRequest,
    @Query({
      schema: sharedFilteredRangeQuerySchema,
      pipes: [new SchemaPipe(sharedFilteredRangeQuerySchema)],
    })
    query: SharedFilteredRangeQuery,
  ): Promise<GoalsSummaryBody> {
    const goals = goalsOf(request);
    return goalsSummaryBody(
      await this.getGoalsSummary.execute(projectOf(request), goals, filteredRangeOf(query, goals)),
    );
  }

  @Get('acquisition')
  @ApiRange()
  @ApiReportFilters(...FILTERS_NOT_SHARED)
  @ApiGoal()
  @ApiOperation({ summary: 'Visits per day and channel, and the sources that brought them' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: acquisitionReportSchema })
  async acquisition(
    @Req() request: FastifyRequest,
    @Query({
      schema: sharedConversionRangeQuerySchema,
      pipes: [new SchemaPipe(sharedConversionRangeQuerySchema)],
    })
    query: SharedConversionRangeQuery,
  ): Promise<AcquisitionReportBody> {
    return acquisitionBody(
      await this.getAcquisition.execute(
        projectOf(request),
        filteredRangeOf(query, goalsOf(request)),
      ),
    );
  }

  @Get('devices')
  @ApiRange()
  @ApiReportFilters(...FILTERS_NOT_SHARED)
  @ApiGoal()
  @ApiOperation({ summary: 'Visits and conversions by device, browser, system and place' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: devicesReportSchema })
  async devices(
    @Req() request: FastifyRequest,
    @Query({
      schema: sharedConversionRangeQuerySchema,
      pipes: [new SchemaPipe(sharedConversionRangeQuerySchema)],
    })
    query: SharedConversionRangeQuery,
  ): Promise<DevicesReportBody> {
    return devicesBody(
      await this.getDevices.execute(projectOf(request), filteredRangeOf(query, goalsOf(request))),
    );
  }

  @Get('features')
  @ApiRange()
  @ApiQuery({ name: 'kind', enum: ['events', 'screens'] })
  @ApiReportFilters(...FILTERS_NOT_SHARED)
  @ApiOperation({ summary: 'The most used named events or screens, with their daily counts' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: featuresReportSchema })
  async features(
    @Req() request: FastifyRequest,
    @Query({
      schema: sharedFeaturesQuerySchema,
      pipes: [new SchemaPipe(sharedFeaturesQuerySchema)],
    })
    query: SharedFeaturesQuery,
  ): Promise<FeaturesReportBody> {
    return featuresBody(
      await this.getFeatures.execute(
        projectOf(request),
        filteredRangeOf(query, goalsOf(request)),
        query.kind,
      ),
    );
  }

  @Get('engagement')
  @ApiRange()
  @ApiReportFilters(...FILTERS_NOT_SHARED)
  @ApiOperation({ summary: 'Entry and exit pages, single-page visits and visit length' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: engagementReportSchema })
  async engagement(
    @Req() request: FastifyRequest,
    @Query({
      schema: sharedFilteredRangeQuerySchema,
      pipes: [new SchemaPipe(sharedFilteredRangeQuerySchema)],
    })
    query: SharedFilteredRangeQuery,
  ): Promise<EngagementReportBody> {
    return engagementBody(
      await this.getEngagement.execute(
        projectOf(request),
        filteredRangeOf(query, goalsOf(request)),
      ),
    );
  }

  @Get('funnel')
  @ApiRange()
  @ApiQuery({ name: 'mode', enum: ['visit', 'user'] })
  @ApiQuery({
    name: 'steps',
    description: 'The steps of the funnel, as for GET /v1/projects/{projectId}/funnel',
    schema: { type: 'string' },
  })
  @ApiReportFilters(...FILTERS_NOT_SHARED)
  @ApiOperation({ summary: 'How many visits or people reached each step of a funnel, in order' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: funnelReportSchema })
  async funnel(
    @Req() request: FastifyRequest,
    @Query({ schema: sharedFunnelQuerySchema, pipes: [new SchemaPipe(sharedFunnelQuerySchema)] })
    query: SharedFunnelQuery,
  ): Promise<FunnelReportBody> {
    return funnelBody(
      await this.getFunnel.execute(
        projectOf(request),
        filteredRangeOf(query, goalsOf(request)),
        query.mode,
        query.steps,
      ),
    );
  }

  @Get('funnel/segments')
  @ApiRange()
  @ApiQuery({
    name: 'steps',
    description: 'The steps of the funnel, as for GET /v1/projects/{projectId}/funnel',
    schema: { type: 'string' },
  })
  @ApiQuery({ name: 'by', enum: FUNNEL_SEGMENT_DIMENSIONS })
  @ApiReportFilters(...FILTERS_NOT_SHARED)
  @ApiOperation({ summary: 'A funnel per device type or channel of the visit' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: funnelSegmentsReportSchema })
  async funnelSegments(
    @Req() request: FastifyRequest,
    @Query({
      schema: sharedFunnelSegmentsQuerySchema,
      pipes: [new SchemaPipe(sharedFunnelSegmentsQuerySchema)],
    })
    query: SharedFunnelSegmentsQuery,
  ): Promise<FunnelSegmentsReportBody> {
    return funnelSegmentsBody(
      query.by,
      await this.getFunnelSegments.execute(
        projectOf(request),
        filteredRangeOf(query, goalsOf(request)),
        query.steps,
        query.by,
      ),
    );
  }
}

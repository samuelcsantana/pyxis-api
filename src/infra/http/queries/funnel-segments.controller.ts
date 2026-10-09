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
import { FUNNEL_SEGMENT_DIMENSIONS } from '../../../domain/queries/funnel';
import { GetFunnelSegmentsUseCase } from '../../../usecases/queries/get-funnel-segments.usecase';
import { SessionGuard } from '../auth/auth.guards';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { SchemaPipe } from '../schema-pipe';
import {
  type FunnelSegmentsQuery,
  funnelSegmentsQuerySchema,
  type FunnelSegmentsReportBody,
  funnelSegmentsReportSchema,
} from './funnel-segments.schemas';
import { ProjectAccessGuard, projectOf } from './project-access.guard';
import { ApiRange } from './queries.controller';

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
export class FunnelSegmentsController {
  constructor(private readonly getFunnelSegments: GetFunnelSegmentsUseCase) {}

  @Get('funnel/segments')
  @ApiRange()
  @ApiOperation({ summary: 'A funnel per device type or channel of the visit' })
  @ApiQuery({
    name: 'steps',
    description: 'The steps of the funnel, as for /funnel',
    schema: { type: 'string' },
  })
  @ApiQuery({ name: 'by', enum: FUNNEL_SEGMENT_DIMENSIONS })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: funnelSegmentsReportSchema })
  async segments(
    @Req() request: FastifyRequest,
    @Query({
      schema: funnelSegmentsQuerySchema,
      pipes: [new SchemaPipe(funnelSegmentsQuerySchema)],
    })
    query: FunnelSegmentsQuery,
  ): Promise<FunnelSegmentsReportBody> {
    const segments = await this.getFunnelSegments.execute(
      projectOf(request),
      { from: query.from, to: query.to },
      query.steps,
      query.by,
    );
    return {
      by: query.by,
      segments: segments.map((segment) => ({
        segment: segment.segment,
        steps: [...segment.counts],
      })),
    };
  }
}

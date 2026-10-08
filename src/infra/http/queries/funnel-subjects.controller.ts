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
import {
  FUNNEL_MODES,
  FUNNEL_OUTCOMES,
  type FunnelSubjectsReport,
} from '../../../domain/queries/funnel';
import { GetFunnelSubjectsUseCase } from '../../../usecases/queries/get-funnel-subjects.usecase';
import { SessionGuard } from '../auth/auth.guards';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { SchemaPipe } from '../schema-pipe';
import {
  funnelSubjectCursorText,
  type FunnelSubjectsQuery,
  funnelSubjectsQuerySchema,
  type FunnelSubjectsReportBody,
  funnelSubjectsReportSchema,
} from './funnel-subjects.schemas';
import { ProjectAccessGuard, projectOf } from './project-access.guard';
import { ApiRange } from './queries.controller';

function funnelSubjectsBody(report: FunnelSubjectsReport): FunnelSubjectsReportBody {
  return {
    subjects: report.subjects.map((subject) => ({
      id: subject.id,
      last_step_at: subject.lastStepAt.toISOString(),
    })),
    next_cursor: report.nextCursor === null ? null : funnelSubjectCursorText(report.nextCursor),
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
export class FunnelSubjectsController {
  constructor(private readonly getFunnelSubjects: GetFunnelSubjectsUseCase) {}

  @Get('funnel/subjects')
  @ApiRange()
  @ApiOperation({ summary: 'The visits or people who reached, or dropped at, one funnel step' })
  @ApiQuery({ name: 'mode', enum: FUNNEL_MODES })
  @ApiQuery({
    name: 'steps',
    description: 'The steps of the funnel, as for /funnel',
    schema: { type: 'string' },
  })
  @ApiQuery({
    name: 'step',
    description: 'The step, 1 for the first; dropped needs 2 or more',
    schema: { type: 'integer', minimum: 1 },
  })
  @ApiQuery({ name: 'outcome', enum: FUNNEL_OUTCOMES })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'The next_cursor of the previous page',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: funnelSubjectsReportSchema })
  async subjects(
    @Req() request: FastifyRequest,
    @Query({
      schema: funnelSubjectsQuerySchema,
      pipes: [new SchemaPipe(funnelSubjectsQuerySchema)],
    })
    query: FunnelSubjectsQuery,
  ): Promise<FunnelSubjectsReportBody> {
    const report = await this.getFunnelSubjects.execute(
      projectOf(request),
      { from: query.from, to: query.to },
      { mode: query.mode, steps: query.steps, stepIndex: query.step - 1, outcome: query.outcome },
      query.cursor ?? null,
    );
    return funnelSubjectsBody(report);
  }
}

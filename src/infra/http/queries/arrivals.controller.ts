import { Controller, Get, HttpStatus, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { GetArrivalsUseCase } from '../../../usecases/queries/get-arrivals.usecase';
import { ReadAccess } from '../auth/read-access.decorator';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { ApiAccountSuspended } from '../errors/account-suspended.response';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { ARRIVALS_THROTTLER } from '../rate-limit/rate-limits';
import { SchemaPipe } from '../schema-pipe';
import {
  type ArrivalsQueryParameters,
  type ArrivalsReportBody,
  arrivalsBody,
  arrivalsQuerySchema,
  arrivalsReportSchema,
} from './arrivals.schemas';
import { ArrivalsThrottlerGuard } from './arrivals-throttler.guard';
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
@ApiAccountSuspended()
@Controller('v1/projects/:projectId')
@ReadAccess(ProjectAccessGuard)
export class ArrivalsController {
  constructor(private readonly getArrivals: GetArrivalsUseCase) {}

  @Get('arrivals')
  @SkipThrottle({ [ARRIVALS_THROTTLER]: false })
  @UseGuards(ArrivalsThrottlerGuard)
  @ApiRange()
  @ApiQuery({
    name: 'since',
    description: 'Count what arrived after this moment; earlier than 7 days ago counts from then',
    schema: { type: 'string', format: 'date-time' },
  })
  @ApiOperation({
    summary: 'What reached the project since a moment, inside the range, kind by kind',
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: arrivalsReportSchema })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'More than 30 asks a minute from one session or token.',
    standardSchema: errorResponseSchema,
  })
  async arrivals(
    @Req() request: FastifyRequest,
    @Query({ schema: arrivalsQuerySchema, pipes: [new SchemaPipe(arrivalsQuerySchema)] })
    query: ArrivalsQueryParameters,
  ): Promise<ArrivalsReportBody> {
    const report = await this.getArrivals.execute(
      projectOf(request),
      { from: query.from, to: query.to },
      new Date(query.since),
    );
    return arrivalsBody(report);
  }
}

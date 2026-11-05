import { Controller, Get, HttpStatus, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { ListAnnotationsUseCase } from '../../../usecases/annotations/list-annotations.usecase';
import { ReadAccess } from '../auth/read-access.decorator';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { ApiAccountSuspended } from '../errors/account-suspended.response';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { ProjectAccessGuard, projectOf } from '../queries/project-access.guard';
import { ApiRange } from '../queries/queries.controller';
import { type RangeQuery, rangeQuerySchema } from '../queries/query.schemas';
import { SchemaPipe } from '../schema-pipe';
import {
  type AnnotationListBody,
  annotationListBody,
  annotationListSchema,
} from './annotations.schemas';

@ApiTags('annotations')
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
@Controller('v1/projects/:projectId/annotations')
@ReadAccess(ProjectAccessGuard)
export class AnnotationsController {
  constructor(private readonly listAnnotations: ListAnnotationsUseCase) {}

  @Get()
  @ApiRange()
  @ApiOperation({
    summary: 'The notes on the days of a range, for anyone who reads the project',
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: annotationListSchema })
  async list(
    @Req() request: FastifyRequest,
    @Query({ schema: rangeQuerySchema, pipes: [new SchemaPipe(rangeQuerySchema)] })
    query: RangeQuery,
  ): Promise<AnnotationListBody> {
    return annotationListBody(
      await this.listAnnotations.execute(projectOf(request), query.from, query.to),
    );
  }
}

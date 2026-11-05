import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { MAX_ANNOTATIONS_PER_PROJECT } from '../../../domain/annotations/annotation';
import { CreateAnnotationUseCase } from '../../../usecases/annotations/create-annotation.usecase';
import { DeleteAnnotationUseCase } from '../../../usecases/annotations/delete-annotation.usecase';
import { UpdateAnnotationUseCase } from '../../../usecases/annotations/update-annotation.usecase';
import { adminOf, DashboardOriginGuard, SessionGuard } from '../auth/auth.guards';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import {
  ApiAccountSuspended,
  SUSPENDED_OR_FOREIGN_ORIGIN_DESCRIPTION,
} from '../errors/account-suspended.response';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { idSchema } from '../projects/projects.schemas';
import { skipThrottlersExcept } from '../rate-limit/rate-limits';
import { SchemaPipe } from '../schema-pipe';
import {
  type AnnotationBody,
  annotationBody,
  type AnnotationChangesBody,
  annotationChangesSchema,
  annotationIdSchema,
  annotationSchema,
  type NewAnnotationBody,
  newAnnotationSchema,
} from './annotations.schemas';

@ApiTags('annotations')
@ApiCookieAuth(SESSION_COOKIE_NAME)
@ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
@ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
@ApiResponse({
  status: HttpStatus.NOT_FOUND,
  description:
    'The project is not one the admin owns (project_not_found), or the annotation is not one of ' +
    'its annotations (annotation_not_found).',
  standardSchema: errorResponseSchema,
})
@ApiAccountSuspended(SUSPENDED_OR_FOREIGN_ORIGIN_DESCRIPTION)
@ApiParam({ name: 'projectId', schema: { type: 'string', format: 'uuid' } })
@Controller('v1/projects/:projectId/annotations')
@SkipThrottle(skipThrottlersExcept())
@UseGuards(DashboardOriginGuard, SessionGuard)
export class AnnotationSettingsController {
  constructor(
    private readonly createAnnotation: CreateAnnotationUseCase,
    private readonly updateAnnotation: UpdateAnnotationUseCase,
    private readonly deleteAnnotation: DeleteAnnotationUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Write a note on a day of a project the admin owns',
    description: `In both plans. At most ${String(MAX_ANNOTATIONS_PER_PROJECT)} notes per project.`,
  })
  @ApiResponse({ status: HttpStatus.CREATED, standardSchema: annotationSchema })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'The project already has the most notes it may keep (annotation_limit_reached), or the ' +
      'account has no running subscription (subscription_required).',
    standardSchema: errorResponseSchema,
  })
  async create(
    @Req() request: FastifyRequest,
    @Param('projectId', new SchemaPipe(idSchema)) projectId: string,
    @Body({ schema: newAnnotationSchema, pipes: [new SchemaPipe(newAnnotationSchema)] })
    body: NewAnnotationBody,
  ): Promise<AnnotationBody> {
    return annotationBody(
      await this.createAnnotation.execute({
        adminUserId: adminOf(request).id,
        projectId,
        day: body.day,
        text: body.text,
      }),
    );
  }

  @Patch(':annotationId')
  @ApiOperation({ summary: 'Move a note to another day, or rewrite it' })
  @ApiParam({ name: 'annotationId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: annotationSchema })
  async update(
    @Req() request: FastifyRequest,
    @Param('projectId', new SchemaPipe(idSchema)) projectId: string,
    @Param('annotationId', new SchemaPipe(annotationIdSchema)) annotationId: string,
    @Body({ schema: annotationChangesSchema, pipes: [new SchemaPipe(annotationChangesSchema)] })
    body: AnnotationChangesBody,
  ): Promise<AnnotationBody> {
    return annotationBody(
      await this.updateAnnotation.execute({
        adminUserId: adminOf(request).id,
        projectId,
        annotationId,
        ...(body.day === undefined ? {} : { day: body.day }),
        ...(body.text === undefined ? {} : { text: body.text }),
      }),
    );
  }

  @Delete(':annotationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a note' })
  @ApiParam({ name: 'annotationId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Deleted.' })
  async remove(
    @Req() request: FastifyRequest,
    @Param('projectId', new SchemaPipe(idSchema)) projectId: string,
    @Param('annotationId', new SchemaPipe(annotationIdSchema)) annotationId: string,
  ): Promise<void> {
    await this.deleteAnnotation.execute({
      adminUserId: adminOf(request).id,
      projectId,
      annotationId,
    });
  }
}

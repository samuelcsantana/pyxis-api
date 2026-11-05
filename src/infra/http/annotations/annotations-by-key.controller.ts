import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { MAX_ANNOTATIONS_PER_PROJECT } from '../../../domain/annotations/annotation';
import { CreateAnnotationByKeyUseCase } from '../../../usecases/annotations/create-annotation-by-key.usecase';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { ClientAddressThrottlerGuard } from '../rate-limit/client-address-throttler.guard';
import { SUBJECTS_THROTTLER, skipThrottlersExcept } from '../rate-limit/rate-limits';
import { SchemaPipe } from '../schema-pipe';
import { SecretKeyThrottlerGuard } from '../subjects/secret-key-throttler.guard';
import { SecretKeyGuard, secretKeyOf } from '../subjects/secret-key.guard';
import { SECRET_KEY_SCHEME } from '../subjects/subjects.controller';
import {
  type AnnotationBody,
  annotationBody,
  annotationSchema,
  type NewAnnotationBody,
  newAnnotationSchema,
} from './annotations.schemas';

@ApiTags('annotations')
@ApiBearerAuth(SECRET_KEY_SCHEME)
@Controller('v1/annotations')
@UseGuards(ClientAddressThrottlerGuard, SecretKeyGuard, SecretKeyThrottlerGuard)
@SkipThrottle(skipThrottlersExcept(SUBJECTS_THROTTLER))
export class AnnotationsByKeyController {
  constructor(private readonly createAnnotation: CreateAnnotationByKeyUseCase) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Write a note on a day of the secret key's project, from a deploy or a script",
    description:
      'Pro only. Sent from a server with Authorization: Bearer pyxis_sk_…, never from a page. ' +
      `The same rules as the dashboard: today at the latest in the project time zone, 1 to 140 ` +
      `characters, at most ${String(MAX_ANNOTATIONS_PER_PROJECT)} notes per project.`,
  })
  @ApiResponse({ status: HttpStatus.CREATED, standardSchema: annotationSchema })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No live secret key was sent (unknown_key).',
    standardSchema: errorResponseSchema,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      "The project's account is not on Pro (plan_required) or is suspended (account_suspended).",
    standardSchema: errorResponseSchema,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'The project already has the most notes it may keep (annotation_limit_reached), or the ' +
      'account has no running subscription (subscription_required).',
    standardSchema: errorResponseSchema,
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Too many calls from this address, or with this key.',
    standardSchema: errorResponseSchema,
  })
  async create(
    @Req() request: FastifyRequest,
    @Body({ schema: newAnnotationSchema, pipes: [new SchemaPipe(newAnnotationSchema)] })
    body: NewAnnotationBody,
  ): Promise<AnnotationBody> {
    return annotationBody(
      await this.createAnnotation.execute(secretKeyOf(request).projectId, {
        day: body.day,
        text: body.text,
      }),
    );
  }
}

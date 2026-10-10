import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import type { SubjectEventsPage } from '../../../domain/subjects/subject-events';
import { EraseSubjectUseCase } from '../../../usecases/subjects/erase-subject.usecase';
import { ExportSubjectEventsUseCase } from '../../../usecases/subjects/export-subject-events.usecase';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { ClientAddressThrottlerGuard } from '../rate-limit/client-address-throttler.guard';
import { AUTH_THROTTLER, INGEST_THROTTLER } from '../rate-limit/rate-limits';
import { SchemaPipe } from '../schema-pipe';
import { SecretKeyThrottlerGuard } from './secret-key-throttler.guard';
import { SecretKeyGuard, secretKeyOf } from './secret-key.guard';
import {
  type ErasedSubjectBody,
  erasedSubjectSchema,
  type ExportQuery,
  exportQuerySchema,
  type SubjectEventsBody,
  subjectEventsSchema,
  userIdSchema,
} from './subject.schemas';

export const SECRET_KEY_SCHEME = 'secret_key';

function subjectEventsBody(page: SubjectEventsPage): SubjectEventsBody {
  return {
    events: page.events.map((event) => ({
      id: event.id,
      name: event.name,
      occurred_at: event.occurredAt.toISOString(),
      session_id: event.sessionId,
      path: event.path,
      referrer_host: event.referrerHost,
      utm_source: event.utmSource,
      utm_medium: event.utmMedium,
      utm_campaign: event.utmCampaign,
      from_ad_click: event.fromAdClick,
      device_type: event.deviceType,
      browser: event.browser,
      os: event.os,
      country: event.country,
      properties: { ...event.properties },
    })),
    next_after: page.nextAfter,
  };
}

@ApiTags('subjects')
@ApiBearerAuth(SECRET_KEY_SCHEME)
@ApiParam({ name: 'userId', description: 'The user id the site sent to identify' })
@ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
@ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
@ApiResponse({
  status: HttpStatus.TOO_MANY_REQUESTS,
  description: 'Too many calls from this address, or with this key.',
  standardSchema: errorResponseSchema,
})
@Controller('v1/subjects/:userId')
@UseGuards(ClientAddressThrottlerGuard, SecretKeyGuard, SecretKeyThrottlerGuard)
@SkipThrottle({ [INGEST_THROTTLER]: true, [AUTH_THROTTLER]: true })
export class SubjectsController {
  constructor(
    private readonly eraseSubject: EraseSubjectUseCase,
    private readonly exportSubjectEvents: ExportSubjectEventsUseCase,
  ) {}

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Erase every event about a user, the visit they signed up in included' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: erasedSubjectSchema })
  async erase(
    @Req() request: FastifyRequest,
    @Param('userId', new SchemaPipe(userIdSchema)) userId: string,
  ): Promise<ErasedSubjectBody> {
    const erased = await this.eraseSubject.execute(secretKeyOf(request).projectId, userId);
    return { deleted_events: erased.deletedEvents };
  }

  @Get('events')
  @ApiOperation({ summary: 'Export every event about a user, for a data access request' })
  @ApiQuery({ name: 'after', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: subjectEventsSchema })
  async events(
    @Req() request: FastifyRequest,
    @Param('userId', new SchemaPipe(userIdSchema)) userId: string,
    @Query({ schema: exportQuerySchema, pipes: [new SchemaPipe(exportQuerySchema)] })
    query: ExportQuery,
  ): Promise<SubjectEventsBody> {
    const page = await this.exportSubjectEvents.execute(
      secretKeyOf(request).projectId,
      userId,
      query.after ?? null,
    );
    return subjectEventsBody(page);
  }
}

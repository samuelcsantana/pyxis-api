import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Options,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  OriginNotAllowedError,
  UnknownProjectKeyError,
} from '../../../domain/errors/ingest.errors';
import {
  type IngestBatchCommand,
  type IngestBatchResult,
  IngestBatchUseCase,
} from '../../../usecases/ingest/ingest-batch.usecase';
import { arrivedAtOf, singleHeader } from '../request-headers';
import { BatchEnvelopePipe } from './batch-envelope.pipe';
import { ClientAddressThrottlerGuard } from '../rate-limit/client-address-throttler.guard';
import { INGEST_THROTTLER, skipThrottlersExcept } from '../rate-limit/rate-limits';
import { allowOrigin, answerPreflight } from './ingest-cors';
import {
  type BatchEnvelope,
  batchRequestSchema,
  errorResponseSchema,
  type IngestResult,
  ingestResultSchema,
} from './ingest.schemas';

const ERROR_RESPONSES = [
  [HttpStatus.BAD_REQUEST, 'The body is not JSON or does not match BatchRequest.'],
  [
    HttpStatus.UNAUTHORIZED,
    'The key is unknown or revoked; readable by the Origin that sent it, so the tracker drops ' +
      'the batch instead of retrying.',
  ],
  [
    HttpStatus.FORBIDDEN,
    "The Origin header is missing or not one of the project's origins (origin_not_allowed), " +
      "or the project's account used 150% of its monthly events and is paused until the next " +
      'month (quota_exceeded), or the account is suspended for abuse (account_suspended), or ' +
      "the project's own reception is suspended (project_suspended). Each comes with a CORS " +
      'grant to the Origin that sent it, so the tracker drops the batch; a missing or opaque ' +
      'Origin gets none.',
  ],
  [HttpStatus.PAYLOAD_TOO_LARGE, 'The body exceeds 32,768 bytes or holds more than 50 events.'],
  [HttpStatus.TOO_MANY_REQUESTS, 'Too many batches from this address or for this project.'],
] as const;

function commandOf(batch: BatchEnvelope, request: FastifyRequest): IngestBatchCommand {
  return {
    key: batch.key,
    sentAt: new Date(batch.sent_at),
    events: batch.events,
    origin: singleHeader(request, 'origin'),
    userAgent: singleHeader(request, 'user-agent'),
    clientHints: {
      mobile: singleHeader(request, 'sec-ch-ua-mobile'),
      platform: singleHeader(request, 'sec-ch-ua-platform'),
    },
    viewerCountry: singleHeader(request, 'cloudfront-viewer-country'),
    viewerRegion: singleHeader(request, 'cloudfront-viewer-country-region'),
    viewerRegionName: singleHeader(request, 'cloudfront-viewer-country-region-name'),
    arrivedAt: arrivedAtOf(request),
  };
}

function ApiErrorResponses(): MethodDecorator {
  return (target, key, descriptor) => {
    for (const [status, description] of ERROR_RESPONSES) {
      ApiResponse({ status, description, standardSchema: errorResponseSchema })(
        target,
        key,
        descriptor,
      );
    }
  };
}

@ApiTags('ingestion')
@Controller('v1/batch')
@SkipThrottle(skipThrottlersExcept(INGEST_THROTTLER))
export class IngestController {
  private readonly logger = new Logger(IngestController.name);

  constructor(private readonly ingestBatch: IngestBatchUseCase) {}

  @Post()
  @UseGuards(ClientAddressThrottlerGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiConsumes('text/plain', 'application/json')
  @ApiOperation({
    summary: 'Ingest a batch of events from the browser',
    description:
      'Public route, authenticated by the project key in the body and the Origin header. ' +
      'Invalid events are counted as rejected; the rest of the batch is stored. A resent event ' +
      'is a duplicate, never stored twice.',
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'The batch was processed.',
    standardSchema: ingestResultSchema,
  })
  @ApiErrorResponses()
  async ingest(
    @Body({ schema: batchRequestSchema, pipes: [BatchEnvelopePipe] }) batch: BatchEnvelope,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<IngestResult> {
    let result: IngestBatchResult;
    try {
      result = await this.ingestBatch.execute(commandOf(batch, request));
    } catch (error) {
      this.logRefusal(request.requestId, error);
      throw error;
    }
    allowOrigin(reply, result.allowedOrigin);
    this.logOutcome(request.requestId, result);
    return { accepted: result.accepted, duplicates: result.duplicates, rejected: result.rejected };
  }

  @Options()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'CORS preflight for the batch route' })
  preflight(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): void {
    answerPreflight(reply, singleHeader(request, 'origin'));
  }

  private logRefusal(requestId: string, error: unknown): void {
    if (error instanceof UnknownProjectKeyError) {
      this.logger.warn({
        message: 'ingest.batch_refused',
        requestId,
        reason: error.code,
        origin: error.requestOrigin,
      });
      return;
    }
    if (error instanceof OriginNotAllowedError) {
      this.logger.warn({
        message: 'ingest.batch_refused',
        requestId,
        reason: error.code,
        projectId: error.projectId,
        origin: error.requestOrigin,
      });
    }
  }

  private logOutcome(requestId: string, result: IngestBatchResult): void {
    for (const rejection of result.rejections) {
      this.logger.warn({
        message: 'ingest.event_rejected',
        requestId,
        projectId: result.projectId,
        reason: rejection.reason,
        name: rejection.name,
      });
    }
    for (const dropped of result.dropped) {
      this.logger.warn({
        message: 'ingest.property_dropped',
        requestId,
        projectId: result.projectId,
        name: dropped.eventName,
        key: dropped.field,
        reason: dropped.reason,
      });
    }
  }
}

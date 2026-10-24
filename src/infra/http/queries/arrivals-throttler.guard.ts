import { type ExecutionContext, Injectable } from '@nestjs/common';
import {
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerRequest,
} from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { readerOf } from '../auth/authenticated-reader';
import { ClientRateLimitedError } from '../errors/http-errors';
import { ARRIVALS_THROTTLER } from '../rate-limit/rate-limits';

@Injectable()
export class ArrivalsThrottlerGuard extends ThrottlerGuard {
  protected override handleRequest(request: ThrottlerRequest): Promise<boolean> {
    return request.throttler.name === ARRIVALS_THROTTLER
      ? super.handleRequest(request)
      : Promise.resolve(true);
  }

  protected override getTracker(request: FastifyRequest): Promise<string> {
    return Promise.resolve(readerOf(request));
  }

  protected override throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    return Promise.reject(new ClientRateLimitedError(detail.timeToBlockExpire));
  }
}

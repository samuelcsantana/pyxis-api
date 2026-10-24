import { type ExecutionContext, Injectable } from '@nestjs/common';
import {
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerRequest,
} from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { ClientRateLimitedError } from '../errors/http-errors';
import { ACCESS_TOKENS_THROTTLER } from '../rate-limit/rate-limits';
import { singleHeader } from '../request-headers';
import { readerOf } from './authenticated-reader';

function presentedAuthorization(request: FastifyRequest): string | undefined {
  return singleHeader(request, 'authorization');
}

@Injectable()
export class AccessTokenThrottlerGuard extends ThrottlerGuard {
  protected override shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    return Promise.resolve(presentedAuthorization(request) === undefined);
  }

  protected override handleRequest(request: ThrottlerRequest): Promise<boolean> {
    return request.throttler.name === ACCESS_TOKENS_THROTTLER
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

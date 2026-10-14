import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { sha256Hex } from '../../../domain/auth/hashing';
import { ClientRateLimitedError } from '../errors/http-errors';
import { singleHeader } from '../request-headers';

function presentedAuthorization(request: FastifyRequest): string | undefined {
  return singleHeader(request, 'authorization');
}

@Injectable()
export class AccessTokenThrottlerGuard extends ThrottlerGuard {
  protected override shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    return Promise.resolve(presentedAuthorization(request) === undefined);
  }

  protected override getTracker(request: FastifyRequest): Promise<string> {
    return Promise.resolve(sha256Hex(String(presentedAuthorization(request))));
  }

  protected override throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    return Promise.reject(new ClientRateLimitedError(detail.timeToBlockExpire));
  }
}

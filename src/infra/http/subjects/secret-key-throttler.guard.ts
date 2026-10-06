import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { ClientRateLimitedError } from '../errors/http-errors';
import { secretKeyOf } from './secret-key.guard';

@Injectable()
export class SecretKeyThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(request: FastifyRequest): Promise<string> {
    return Promise.resolve(secretKeyOf(request).keyId);
  }

  protected override throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    return Promise.reject(new ClientRateLimitedError(detail.timeToBlockExpire));
  }
}

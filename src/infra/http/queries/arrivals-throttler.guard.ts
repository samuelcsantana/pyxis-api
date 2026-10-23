import { type ExecutionContext, Injectable } from '@nestjs/common';
import {
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerRequest,
} from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { UnauthenticatedError } from '../../../domain/errors/auth.errors';
import { ClientRateLimitedError } from '../errors/http-errors';
import { ARRIVALS_THROTTLER } from '../rate-limit/rate-limits';

export function readerOf(request: FastifyRequest): string {
  if (request.session !== undefined) {
    return `session:${request.session.id}`;
  }
  if (request.accessToken !== undefined) {
    return `token:${request.accessToken.id}`;
  }
  if (request.oauthConnection !== undefined) {
    return `connection:${request.oauthConnection.id}`;
  }
  throw new UnauthenticatedError();
}

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

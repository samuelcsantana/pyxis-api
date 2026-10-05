import { type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import type { EnvConfig } from '../../../config/env.schema';
import { ClientRateLimitedError } from '../errors/http-errors';
import { getClientIp } from '../request-headers';

export const CLIENT_BATCHES_PER_WINDOW = 120;
export const CLIENT_RATE_WINDOW_MS = 60_000;

@Injectable()
export class ClientAddressThrottlerGuard extends ThrottlerGuard {
  @Inject(ConfigService) private readonly config!: ConfigService<EnvConfig, true>;

  protected override getTracker(request: FastifyRequest): Promise<string> {
    return Promise.resolve(
      getClientIp(request, this.config.get('CLIENT_IP_HEADER', { infer: true })),
    );
  }

  protected override throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    return Promise.reject(new ClientRateLimitedError(detail.timeToBlockExpire));
  }
}

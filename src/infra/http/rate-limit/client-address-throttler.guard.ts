import { type ExecutionContext, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import type { EnvConfig } from '../../../config/env.schema';
import { ClientRateLimitedError } from '../errors/http-errors';
import { describeClientIpSources, getClientIp } from '../request-headers';

const logger = new Logger('ClientIp');
let sourcesLogged = false;

@Injectable()
export class ClientAddressThrottlerGuard extends ThrottlerGuard {
  @Inject(ConfigService) private readonly config!: ConfigService<EnvConfig, true>;

  protected override getTracker(request: FastifyRequest): Promise<string> {
    const trustedHeader = this.config.get('CLIENT_IP_HEADER', { infer: true });
    if (!sourcesLogged) {
      sourcesLogged = true;
      logger.log({
        message: 'client_ip.sources',
        ...describeClientIpSources(request, trustedHeader),
      });
    }
    return Promise.resolve(getClientIp(request, trustedHeader));
  }

  protected override throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    return Promise.reject(new ClientRateLimitedError(detail.timeToBlockExpire));
  }
}

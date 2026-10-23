import { applyDecorators, type CanActivate, type Type, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ACCESS_TOKENS_THROTTLER, skipThrottlersExcept } from '../rate-limit/rate-limits';
import { AccessTokenThrottlerGuard } from './access-token-throttler.guard';
import { ReadAccessGuard } from './read-access.guard';

export const ACCESS_TOKEN_SECURITY = 'access_token';
export const CONNECTION_TOKEN_SECURITY = 'connection_token';

export function ReadAccess(...thenGuards: readonly Type<CanActivate>[]) {
  return applyDecorators(
    SkipThrottle(skipThrottlersExcept(ACCESS_TOKENS_THROTTLER)),
    UseGuards(ReadAccessGuard, AccessTokenThrottlerGuard, ...thenGuards),
    ApiBearerAuth(ACCESS_TOKEN_SECURITY),
    ApiBearerAuth(CONNECTION_TOKEN_SECURITY),
  );
}

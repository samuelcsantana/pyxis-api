import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { accessTokenFromAuthorization } from '../../../domain/auth/access-token-policy';
import type { AccessToken } from '../../../domain/entities/access-token.entity';
import { UnauthenticatedError } from '../../../domain/errors/auth.errors';
import { AuthenticateAccessTokenUseCase } from '../../../usecases/auth/authenticate-access-token.usecase';
import { AuthenticateSessionUseCase } from '../../../usecases/auth/authenticate-session.usecase';
import { singleHeader } from '../request-headers';
import { readSessionToken } from './session-cookie';

declare module 'fastify' {
  interface FastifyRequest {
    accessToken?: AccessToken;
  }
}

@Injectable()
export class ReadAccessGuard implements CanActivate {
  constructor(
    private readonly authenticateSession: AuthenticateSessionUseCase,
    private readonly authenticateAccessToken: AuthenticateAccessTokenUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const authorization = singleHeader(request, 'authorization');
    if (authorization === undefined) {
      const authenticated = await this.authenticateSession.execute(
        readSessionToken(singleHeader(request, 'cookie')),
      );
      request.admin = authenticated.admin;
      request.session = authenticated.session;
      return true;
    }
    const secret = accessTokenFromAuthorization(authorization);
    if (secret === null) {
      throw new UnauthenticatedError();
    }
    const authenticated = await this.authenticateAccessToken.execute(secret);
    request.admin = authenticated.admin;
    request.accessToken = authenticated.token;
    return true;
  }
}

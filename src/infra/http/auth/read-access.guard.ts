import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { accessTokenFromAuthorization } from '../../../domain/auth/access-token-policy';
import type { AccessToken } from '../../../domain/entities/access-token.entity';
import type { OAuthConnection } from '../../../domain/entities/oauth-connection.entity';
import { UnauthenticatedError } from '../../../domain/errors/auth.errors';
import { connectionAccessTokenFromAuthorization } from '../../../domain/oauth/oauth-policy';
import { AuthenticateAccessTokenUseCase } from '../../../usecases/auth/authenticate-access-token.usecase';
import { AuthenticateSessionUseCase } from '../../../usecases/auth/authenticate-session.usecase';
import { AuthenticateConnectionTokenUseCase } from '../../../usecases/oauth/authenticate-connection-token.usecase';
import { singleHeader } from '../request-headers';
import { readSessionToken } from './session-cookie';

declare module 'fastify' {
  interface FastifyRequest {
    accessToken?: AccessToken;
    oauthConnection?: OAuthConnection;
  }
}

@Injectable()
export class ReadAccessGuard implements CanActivate {
  constructor(
    private readonly authenticateSession: AuthenticateSessionUseCase,
    private readonly authenticateAccessToken: AuthenticateAccessTokenUseCase,
    private readonly authenticateConnectionToken: AuthenticateConnectionTokenUseCase,
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
    if (secret !== null) {
      const authenticated = await this.authenticateAccessToken.execute(secret);
      request.admin = authenticated.admin;
      request.accessToken = authenticated.token;
      return true;
    }
    const connectionSecret = connectionAccessTokenFromAuthorization(authorization);
    if (connectionSecret === null) {
      throw new UnauthenticatedError();
    }
    const connected = await this.authenticateConnectionToken.execute(connectionSecret);
    request.admin = connected.admin;
    request.oauthConnection = connected.connection;
    return true;
  }
}

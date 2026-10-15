import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { UnauthenticatedError } from '../../../domain/errors/auth.errors';
import {
  REMOTE_MCP_SETTINGS,
  type RemoteMcpSettings,
  requireOpen,
} from '../../../domain/oauth/remote-mcp-settings';
import { AuthenticateAccessTokenUseCase } from '../../../usecases/auth/authenticate-access-token.usecase';
import { AuthenticateConnectionTokenUseCase } from '../../../usecases/oauth/authenticate-connection-token.usecase';
import { singleHeader } from '../request-headers';
import { type McpBearer, mcpBearerOf } from './mcp-caller';
import { McpUnauthorizedError } from './mcp-unauthorized';

@Injectable()
export class McpAccessGuard implements CanActivate {
  constructor(
    @Inject(REMOTE_MCP_SETTINGS) private readonly settings: RemoteMcpSettings,
    private readonly authenticateAccessToken: AuthenticateAccessTokenUseCase,
    private readonly authenticateConnectionToken: AuthenticateConnectionTokenUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { issuer } = requireOpen(this.settings);
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const authorization = singleHeader(request, 'authorization');
    const bearer = mcpBearerOf(authorization);
    if (bearer === null) {
      throw new McpUnauthorizedError(issuer, authorization !== undefined);
    }
    try {
      await this.authenticate(bearer);
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        throw new McpUnauthorizedError(issuer, true);
      }
      throw error;
    }
    request.mcpCaller = { bearer, issuer };
    return true;
  }

  private async authenticate(bearer: McpBearer): Promise<void> {
    switch (bearer.kind) {
      case 'access_token':
        await this.authenticateAccessToken.execute(bearer.secret);
        return;
      case 'connection':
        await this.authenticateConnectionToken.execute(bearer.secret);
        return;
    }
  }
}

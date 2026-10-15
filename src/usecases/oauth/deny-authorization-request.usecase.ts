import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import { AuthorizationRequestNotFoundError } from '../../domain/errors/oauth.errors';
import { authorizationResponseUrl } from '../../domain/oauth/authorization-response';
import {
  REMOTE_MCP_SETTINGS,
  type RemoteMcpSettings,
  requireOpen,
} from '../../domain/oauth/remote-mcp-settings';
import {
  AUTHORIZATION_REQUEST_REPOSITORY,
  type AuthorizationRequestRepository,
} from '../../domain/repositories/authorization-request.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

export const ACCESS_DENIED = 'access_denied';

@Injectable()
export class DenyAuthorizationRequestUseCase {
  private readonly logger = new Logger(DenyAuthorizationRequestUseCase.name);

  constructor(
    @Inject(REMOTE_MCP_SETTINGS) private readonly settings: RemoteMcpSettings,
    @Inject(AUTHORIZATION_REQUEST_REPOSITORY)
    private readonly requests: AuthorizationRequestRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(admin: AdminUser, requestId: string): Promise<string> {
    const settings = requireOpen(this.settings);
    const denied = await this.requests.deny(requestId, this.clock.now());
    if (denied === null) {
      throw new AuthorizationRequestNotFoundError();
    }
    this.logger.log({
      message: 'oauth.authorization_denied',
      requestId,
      adminUserId: admin.id,
      clientId: denied.clientId,
    });
    return authorizationResponseUrl(
      denied.redirectUri,
      {
        error: ACCESS_DENIED,
        error_description: 'The person declined the connection.',
        state: denied.state,
      },
      settings.issuer,
    );
  }
}

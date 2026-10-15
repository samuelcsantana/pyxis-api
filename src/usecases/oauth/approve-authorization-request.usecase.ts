import { Inject, Injectable, Logger } from '@nestjs/common';
import { sha256Hex } from '../../domain/auth/hashing';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import {
  AuthorizationRequestNotFoundError,
  TooManyConnectionsError,
} from '../../domain/errors/oauth.errors';
import { authorizationResponseUrl } from '../../domain/oauth/authorization-response';
import {
  AUTHORIZATION_CODE_TTL_MS,
  generateAuthorizationCode,
  idleConnectionCutoff,
  later,
  MAX_LIVE_CONNECTIONS,
} from '../../domain/oauth/oauth-policy';
import {
  REMOTE_MCP_SETTINGS,
  type RemoteMcpSettings,
  requireOpen,
} from '../../domain/oauth/remote-mcp-settings';
import {
  AUTHORIZATION_REQUEST_REPOSITORY,
  type AuthorizationRequestRepository,
} from '../../domain/repositories/authorization-request.repository';
import {
  OAUTH_CONNECTION_REPOSITORY,
  type OAuthConnectionRepository,
} from '../../domain/repositories/oauth-connection.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { RANDOM_SOURCE, type RandomSource } from '../../domain/services/random-source';

@Injectable()
export class ApproveAuthorizationRequestUseCase {
  private readonly logger = new Logger(ApproveAuthorizationRequestUseCase.name);

  constructor(
    @Inject(REMOTE_MCP_SETTINGS) private readonly settings: RemoteMcpSettings,
    @Inject(AUTHORIZATION_REQUEST_REPOSITORY)
    private readonly requests: AuthorizationRequestRepository,
    @Inject(OAUTH_CONNECTION_REPOSITORY) private readonly connections: OAuthConnectionRepository,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(admin: AdminUser, requestId: string): Promise<string> {
    const settings = requireOpen(this.settings);
    const now = this.clock.now();
    if ((await this.requests.findPending(requestId, now)) === null) {
      throw new AuthorizationRequestNotFoundError();
    }
    const live = await this.connections.listLiveOf(admin.id, idleConnectionCutoff(now));
    if (live.length >= MAX_LIVE_CONNECTIONS) {
      throw new TooManyConnectionsError(MAX_LIVE_CONNECTIONS);
    }
    const code = generateAuthorizationCode(this.random);
    const approved = await this.requests.approve(requestId, {
      adminUserId: admin.id,
      codeHash: sha256Hex(code),
      codeExpiresAt: later(now, AUTHORIZATION_CODE_TTL_MS),
      decidedAt: now,
    });
    if (approved === null) {
      throw new AuthorizationRequestNotFoundError();
    }
    this.logger.log({
      message: 'oauth.authorization_approved',
      requestId,
      adminUserId: admin.id,
      clientId: approved.clientId,
    });
    return authorizationResponseUrl(
      approved.redirectUri,
      { code, state: approved.state },
      settings.issuer,
    );
  }
}

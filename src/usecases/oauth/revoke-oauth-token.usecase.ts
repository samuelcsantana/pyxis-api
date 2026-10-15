import { Inject, Injectable, Logger } from '@nestjs/common';
import { sha256Hex } from '../../domain/auth/hashing';
import {
  REMOTE_MCP_SETTINGS,
  type RemoteMcpSettings,
  requireOpen,
} from '../../domain/oauth/remote-mcp-settings';
import {
  OAUTH_CONNECTION_REPOSITORY,
  type OAuthConnectionRepository,
} from '../../domain/repositories/oauth-connection.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { required } from './connection-token-grant';

export interface TokenRevocation {
  readonly token?: string;
}

@Injectable()
export class RevokeOAuthTokenUseCase {
  private readonly logger = new Logger(RevokeOAuthTokenUseCase.name);

  constructor(
    @Inject(REMOTE_MCP_SETTINGS) private readonly settings: RemoteMcpSettings,
    @Inject(OAUTH_CONNECTION_REPOSITORY) private readonly connections: OAuthConnectionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(revocation: TokenRevocation): Promise<void> {
    requireOpen(this.settings);
    const token = required(revocation.token, 'token');
    const connection = await this.connections.findLiveByAnyToken(sha256Hex(token));
    if (connection === null) {
      return;
    }
    await this.connections.revoke(connection.id, this.clock.now());
    this.logger.log({
      message: 'oauth.connection_revoked',
      connectionId: connection.id,
      by: 'client',
    });
  }
}

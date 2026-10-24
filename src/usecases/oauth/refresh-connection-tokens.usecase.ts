import { Inject, Injectable, Logger } from '@nestjs/common';
import { sha256Hex } from '../../domain/auth/hashing';
import {
  hasReachedReplayCap,
  isConnectionIdle,
  isWithinReplayGrace,
} from '../../domain/oauth/oauth-policy';
import {
  REMOTE_MCP_SETTINGS,
  type RemoteMcpSettings,
  requireOpen,
} from '../../domain/oauth/remote-mcp-settings';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../domain/repositories/admin-user.repository';
import {
  OAUTH_CONNECTION_REPOSITORY,
  type OAuthConnectionRepository,
  type StoredRefreshToken,
} from '../../domain/repositories/oauth-connection.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { RANDOM_SOURCE, type RandomSource } from '../../domain/services/random-source';
import {
  invalidGrant,
  issueTokenPair,
  required,
  requireActiveAdmin,
  requireAllowedClient,
  requireOwnResource,
  type TokenGrant,
} from './connection-token-grant';

export interface TokenRefresh {
  readonly refreshToken?: string;
  readonly clientId?: string;
  readonly resource?: string;
}

@Injectable()
export class RefreshConnectionTokensUseCase {
  private readonly logger = new Logger(RefreshConnectionTokensUseCase.name);

  constructor(
    @Inject(REMOTE_MCP_SETTINGS) private readonly settings: RemoteMcpSettings,
    @Inject(OAUTH_CONNECTION_REPOSITORY) private readonly connections: OAuthConnectionRepository,
    @Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(refresh: TokenRefresh): Promise<TokenGrant> {
    const settings = requireOpen(this.settings);
    const clientId = requireAllowedClient(refresh.clientId);
    const refreshToken = required(refresh.refreshToken, 'refresh_token');
    requireOwnResource(refresh.resource, settings.issuer);
    const now = this.clock.now();
    const stored = await this.connections.findRefreshToken(sha256Hex(refreshToken));
    if (stored === null) {
      throw invalidGrant();
    }
    if (stored.rotatedAt !== null && !isWithinReplayGrace(stored.rotatedAt, now)) {
      await this.dropReplayedConnection(stored, now);
      throw invalidGrant();
    }
    const connection = await this.connections.findLive(stored.connectionId);
    if (
      connection?.clientId !== clientId ||
      now.getTime() >= stored.expiresAt.getTime() ||
      isConnectionIdle(connection.lastUsedAt, now)
    ) {
      throw invalidGrant();
    }
    await requireActiveAdmin(this.admins, connection.adminUserId);
    if (stored.rotatedAt === null) {
      await this.connections.markRefreshTokenRotated(stored.id, now);
    } else {
      await this.refuseReplayPastTheCap(connection.id, now);
    }
    const pair = issueTokenPair(this.random, now);
    await this.connections.issueTokens(connection.id, now, pair.tokens);
    await this.connections.touch(connection.id, now);
    return pair.grant;
  }

  private async refuseReplayPastTheCap(connectionId: string, now: Date): Promise<void> {
    const liveAccessTokens = await this.connections.countLiveAccessTokens(connectionId, now);
    if (hasReachedReplayCap(liveAccessTokens)) {
      this.logger.warn({ message: 'oauth.refresh_replay_capped', connectionId });
      throw invalidGrant();
    }
  }

  private async dropReplayedConnection(stored: StoredRefreshToken, now: Date): Promise<void> {
    if (await this.connections.revoke(stored.connectionId, now)) {
      this.logger.warn({
        message: 'oauth.refresh_token_replayed',
        connectionId: stored.connectionId,
      });
    }
  }
}

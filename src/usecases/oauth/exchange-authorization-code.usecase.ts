import { Inject, Injectable, Logger } from '@nestjs/common';
import { sha256Hex } from '../../domain/auth/hashing';
import { verifierMatches } from '../../domain/oauth/oauth-policy';
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
  AUTHORIZATION_REQUEST_REPOSITORY,
  type AuthorizationRequestRepository,
} from '../../domain/repositories/authorization-request.repository';
import {
  OAUTH_CONNECTION_REPOSITORY,
  type OAuthConnectionRepository,
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

export interface CodeExchange {
  readonly code?: string;
  readonly codeVerifier?: string;
  readonly clientId?: string;
  readonly redirectUri?: string;
  readonly resource?: string;
}

@Injectable()
export class ExchangeAuthorizationCodeUseCase {
  private readonly logger = new Logger(ExchangeAuthorizationCodeUseCase.name);

  constructor(
    @Inject(REMOTE_MCP_SETTINGS) private readonly settings: RemoteMcpSettings,
    @Inject(AUTHORIZATION_REQUEST_REPOSITORY)
    private readonly requests: AuthorizationRequestRepository,
    @Inject(OAUTH_CONNECTION_REPOSITORY) private readonly connections: OAuthConnectionRepository,
    @Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(exchange: CodeExchange): Promise<TokenGrant> {
    const settings = requireOpen(this.settings);
    const clientId = requireAllowedClient(exchange.clientId);
    const code = required(exchange.code, 'code');
    const codeVerifier = required(exchange.codeVerifier, 'code_verifier');
    requireOwnResource(exchange.resource, settings.issuer);
    const now = this.clock.now();
    const codeHash = sha256Hex(code);
    const redeemed = await this.requests.redeemCode(codeHash, now);
    if (redeemed === null) {
      await this.dropConnectionOfReplayedCode(codeHash, now);
      throw invalidGrant();
    }
    const { request } = redeemed;
    if (
      request.clientId !== clientId ||
      (exchange.redirectUri !== undefined && exchange.redirectUri !== request.redirectUri) ||
      !verifierMatches(codeVerifier, request.codeChallenge)
    ) {
      throw invalidGrant();
    }
    await requireActiveAdmin(this.admins, redeemed.adminUserId);
    const pair = issueTokenPair(this.random, now);
    const connection = await this.connections.create(
      { adminUserId: redeemed.adminUserId, clientId, createdAt: now },
      pair.tokens,
    );
    await this.requests.linkConnection(request.id, connection.id);
    this.logger.log({
      message: 'oauth.connection_created',
      connectionId: connection.id,
      adminUserId: connection.adminUserId,
      clientId,
    });
    return pair.grant;
  }

  private async dropConnectionOfReplayedCode(codeHash: string, now: Date): Promise<void> {
    const connectionId = (await this.requests.findSpentCode(codeHash))?.connectionId ?? null;
    if (connectionId === null) {
      return;
    }
    await this.connections.revoke(connectionId, now);
    this.logger.warn({ message: 'oauth.code_replayed', connectionId });
  }
}

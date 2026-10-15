import { Inject, Injectable } from '@nestjs/common';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import { AuthorizationRequestNotFoundError } from '../../domain/errors/oauth.errors';
import {
  type AllowedClient,
  allowedClient,
  hostnameOf,
  isLoopbackRedirect,
} from '../../domain/oauth/oauth-clients';
import { idleConnectionCutoff, MAX_LIVE_CONNECTIONS } from '../../domain/oauth/oauth-policy';
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

export interface ConsentProject {
  readonly id: string;
  readonly name: string;
}

export interface DescribedAuthorizationRequest {
  readonly id: string;
  readonly client: AllowedClient;
  readonly clientHost: string;
  readonly redirectHost: string;
  readonly loopback: boolean;
  readonly expiresAt: Date;
  readonly projects: readonly ConsentProject[];
  readonly connectionLimitReached: boolean;
}

@Injectable()
export class DescribeAuthorizationRequestUseCase {
  constructor(
    @Inject(REMOTE_MCP_SETTINGS) private readonly settings: RemoteMcpSettings,
    @Inject(AUTHORIZATION_REQUEST_REPOSITORY)
    private readonly requests: AuthorizationRequestRepository,
    @Inject(OAUTH_CONNECTION_REPOSITORY) private readonly connections: OAuthConnectionRepository,
    @Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(admin: AdminUser, requestId: string): Promise<DescribedAuthorizationRequest> {
    requireOpen(this.settings);
    const now = this.clock.now();
    const request = await this.requests.findPending(requestId, now);
    const client = request === null ? null : allowedClient(request.clientId);
    if (request === null || client === null) {
      throw new AuthorizationRequestNotFoundError();
    }
    const live = await this.connections.listLiveOf(admin.id, idleConnectionCutoff(now));
    const projects = await this.admins.projectsOf(admin.id);
    return {
      id: request.id,
      client,
      clientHost: hostnameOf(client.id),
      redirectHost: hostnameOf(request.redirectUri),
      loopback: isLoopbackRedirect(request.redirectUri),
      expiresAt: request.expiresAt,
      projects: projects.map((project) => ({ id: project.id, name: project.name })),
      connectionLimitReached: live.length >= MAX_LIVE_CONNECTIONS,
    };
  }
}

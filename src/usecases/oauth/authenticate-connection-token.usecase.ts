import { Inject, Injectable } from '@nestjs/common';
import { isSuspended } from '../../domain/accounts/account-suspension';
import { sha256Hex } from '../../domain/auth/hashing';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import type { OAuthConnection } from '../../domain/entities/oauth-connection.entity';
import { UnauthenticatedError } from '../../domain/errors/auth.errors';
import { connectionNeedsTouch, isConnectionIdle } from '../../domain/oauth/oauth-policy';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../domain/repositories/admin-user.repository';
import {
  OAUTH_CONNECTION_REPOSITORY,
  type OAuthConnectionRepository,
} from '../../domain/repositories/oauth-connection.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

export interface AuthenticatedConnection {
  readonly admin: AdminUser;
  readonly connection: OAuthConnection;
}

@Injectable()
export class AuthenticateConnectionTokenUseCase {
  constructor(
    @Inject(OAUTH_CONNECTION_REPOSITORY) private readonly connections: OAuthConnectionRepository,
    @Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(secret: string): Promise<AuthenticatedConnection> {
    const now = this.clock.now();
    const connection = await this.connections.findLiveByAccessToken(sha256Hex(secret), now);
    if (connection === null || isConnectionIdle(connection.lastUsedAt, now)) {
      throw new UnauthenticatedError();
    }
    if (connectionNeedsTouch(connection.lastUsedAt, now)) {
      await this.connections.touch(connection.id, now);
    }
    const admin = await this.admins.findById(connection.adminUserId);
    if (admin === null || isSuspended(admin)) {
      throw new UnauthenticatedError();
    }
    return { admin, connection };
  }
}

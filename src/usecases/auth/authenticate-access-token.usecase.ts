import { Inject, Injectable } from '@nestjs/common';
import { isSuspended } from '../../domain/accounts/account-suspension';
import { accessTokenNeedsTouch, isAccessTokenActive } from '../../domain/auth/access-token-policy';
import { sha256Hex } from '../../domain/auth/hashing';
import type { AccessToken } from '../../domain/entities/access-token.entity';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import { UnauthenticatedError } from '../../domain/errors/auth.errors';
import {
  ACCESS_TOKEN_REPOSITORY,
  type AccessTokenRepository,
} from '../../domain/repositories/access-token.repository';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../domain/repositories/admin-user.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

export interface AuthenticatedAccessToken {
  readonly admin: AdminUser;
  readonly token: AccessToken;
}

@Injectable()
export class AuthenticateAccessTokenUseCase {
  constructor(
    @Inject(ACCESS_TOKEN_REPOSITORY) private readonly tokens: AccessTokenRepository,
    @Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(secret: string): Promise<AuthenticatedAccessToken> {
    const token = await this.tokens.findLiveByTokenHash(sha256Hex(secret));
    const now = this.clock.now();
    if (token === null || !isAccessTokenActive(token, now)) {
      throw new UnauthenticatedError();
    }
    if (accessTokenNeedsTouch(token, now)) {
      await this.tokens.touch(token.id, now);
    }
    const admin = await this.admins.findById(token.adminUserId);
    if (admin === null || isSuspended(admin)) {
      throw new UnauthenticatedError();
    }
    return { admin, token };
  }
}

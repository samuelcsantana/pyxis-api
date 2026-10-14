import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import { AccessTokenNotFoundError } from '../../domain/errors/auth.errors';
import {
  ACCESS_TOKEN_REPOSITORY,
  type AccessTokenRepository,
} from '../../domain/repositories/access-token.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

@Injectable()
export class RevokeAccessTokenUseCase {
  private readonly logger = new Logger(RevokeAccessTokenUseCase.name);

  constructor(
    @Inject(ACCESS_TOKEN_REPOSITORY) private readonly tokens: AccessTokenRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(admin: AdminUser, tokenId: string): Promise<void> {
    const revoked = await this.tokens.revokeOneOf(admin.id, tokenId, this.clock.now());
    if (!revoked) {
      throw new AccessTokenNotFoundError();
    }
    this.logger.log({ message: 'auth.access_token_revoked', adminUserId: admin.id, tokenId });
  }
}

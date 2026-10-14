import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type AccessTokenLifetimeDays,
  accessTokenExpiry,
  generateAccessToken,
  MAX_LIVE_ACCESS_TOKENS,
} from '../../domain/auth/access-token-policy';
import { sha256Hex } from '../../domain/auth/hashing';
import type { AccessToken } from '../../domain/entities/access-token.entity';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import { TooManyAccessTokensError } from '../../domain/errors/auth.errors';
import {
  ACCESS_TOKEN_REPOSITORY,
  type AccessTokenRepository,
} from '../../domain/repositories/access-token.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { RANDOM_SOURCE, type RandomSource } from '../../domain/services/random-source';

export interface CreateAccessTokenCommand {
  readonly name: string;
  readonly lifetimeDays: AccessTokenLifetimeDays;
}

export interface CreatedAccessToken {
  readonly token: AccessToken;
  readonly secret: string;
}

@Injectable()
export class CreateAccessTokenUseCase {
  private readonly logger = new Logger(CreateAccessTokenUseCase.name);

  constructor(
    @Inject(ACCESS_TOKEN_REPOSITORY) private readonly tokens: AccessTokenRepository,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(admin: AdminUser, command: CreateAccessTokenCommand): Promise<CreatedAccessToken> {
    const now = this.clock.now();
    const live = await this.tokens.listLiveOf(admin.id, now);
    if (live.length >= MAX_LIVE_ACCESS_TOKENS) {
      throw new TooManyAccessTokensError(MAX_LIVE_ACCESS_TOKENS);
    }
    const secret = generateAccessToken(this.random);
    const token = await this.tokens.create({
      adminUserId: admin.id,
      name: command.name,
      tokenHash: sha256Hex(secret),
      createdAt: now,
      expiresAt: accessTokenExpiry(now, command.lifetimeDays),
    });
    this.logger.log({
      message: 'auth.access_token_created',
      adminUserId: admin.id,
      tokenId: token.id,
    });
    return { token, secret };
  }
}

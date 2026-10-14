import type { AccessToken } from '../entities/access-token.entity';

export interface NewAccessToken {
  readonly adminUserId: string;
  readonly name: string;
  readonly tokenHash: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface AccessTokenRepository {
  create(token: NewAccessToken): Promise<AccessToken>;
  findLiveByTokenHash(tokenHash: string): Promise<AccessToken | null>;
  listLiveOf(adminUserId: string, now: Date): Promise<readonly AccessToken[]>;
  touch(tokenId: string, usedAt: Date): Promise<void>;
  revokeOneOf(adminUserId: string, tokenId: string, revokedAt: Date): Promise<boolean>;
}

export const ACCESS_TOKEN_REPOSITORY = Symbol('AccessTokenRepository');

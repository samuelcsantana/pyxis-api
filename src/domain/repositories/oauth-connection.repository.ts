import type { OAuthConnection } from '../entities/oauth-connection.entity';
import type { ConnectionTokenKind } from '../oauth/oauth-policy';

export interface NewConnection {
  readonly adminUserId: string;
  readonly clientId: string;
  readonly createdAt: Date;
}

export interface NewConnectionToken {
  readonly kind: ConnectionTokenKind;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export interface StoredRefreshToken {
  readonly id: string;
  readonly connectionId: string;
  readonly expiresAt: Date;
  readonly rotatedAt: Date | null;
}

export interface OAuthConnectionRepository {
  create(
    connection: NewConnection,
    tokens: readonly NewConnectionToken[],
  ): Promise<OAuthConnection>;
  issueTokens(
    connectionId: string,
    issuedAt: Date,
    tokens: readonly NewConnectionToken[],
  ): Promise<void>;
  findLive(connectionId: string): Promise<OAuthConnection | null>;
  findLiveByAccessToken(tokenHash: string, now: Date): Promise<OAuthConnection | null>;
  findLiveByAnyToken(tokenHash: string): Promise<OAuthConnection | null>;
  findRefreshToken(tokenHash: string): Promise<StoredRefreshToken | null>;
  markRefreshTokenRotated(tokenId: string, rotatedAt: Date): Promise<boolean>;
  countLiveAccessTokens(connectionId: string, now: Date): Promise<number>;
  listLiveOf(adminUserId: string, idleCutoff: Date): Promise<readonly OAuthConnection[]>;
  touch(connectionId: string, usedAt: Date): Promise<void>;
  revoke(connectionId: string, revokedAt: Date): Promise<boolean>;
  revokeOneOf(adminUserId: string, connectionId: string, revokedAt: Date): Promise<boolean>;
  revokeAllOf(adminUserId: string, revokedAt: Date): Promise<number>;
}

export const OAUTH_CONNECTION_REPOSITORY = Symbol('OAuthConnectionRepository');

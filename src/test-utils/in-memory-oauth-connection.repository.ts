import type { OAuthConnection } from '../domain/entities/oauth-connection.entity';
import type { ConnectionTokenKind } from '../domain/oauth/oauth-policy';
import type {
  NewConnection,
  NewConnectionToken,
  OAuthConnectionRepository,
  StoredRefreshToken,
} from '../domain/repositories/oauth-connection.repository';

interface StoredConnection {
  connection: OAuthConnection;
  revokedAt: Date | null;
}

interface StoredConnectionToken {
  readonly id: string;
  readonly connectionId: string;
  readonly kind: ConnectionTokenKind;
  readonly tokenHash: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  rotatedAt: Date | null;
}

export class InMemoryOAuthConnectionRepository implements OAuthConnectionRepository {
  readonly connections: StoredConnection[] = [];
  readonly tokens: StoredConnectionToken[] = [];

  create(input: NewConnection, tokens: readonly NewConnectionToken[]): Promise<OAuthConnection> {
    const connection: OAuthConnection = {
      id: `00000000-0000-4000-8000-${String(this.connections.length + 1).padStart(12, '0')}`,
      adminUserId: input.adminUserId,
      clientId: input.clientId,
      createdAt: input.createdAt,
      lastUsedAt: input.createdAt,
    };
    this.connections.push({ connection, revokedAt: null });
    this.store(connection.id, input.createdAt, tokens);
    return Promise.resolve(connection);
  }

  issueTokens(
    connectionId: string,
    issuedAt: Date,
    tokens: readonly NewConnectionToken[],
  ): Promise<void> {
    this.store(connectionId, issuedAt, tokens);
    return Promise.resolve();
  }

  findLive(connectionId: string): Promise<OAuthConnection | null> {
    return Promise.resolve(this.live(connectionId)?.connection ?? null);
  }

  findLiveByAccessToken(tokenHash: string, now: Date): Promise<OAuthConnection | null> {
    const token = this.tokens.find(
      (candidate) =>
        candidate.tokenHash === tokenHash &&
        candidate.kind === 'access' &&
        now.getTime() < candidate.expiresAt.getTime(),
    );
    return Promise.resolve(token === undefined ? null : this.findLiveSync(token.connectionId));
  }

  findLiveByAnyToken(tokenHash: string): Promise<OAuthConnection | null> {
    const token = this.tokens.find((candidate) => candidate.tokenHash === tokenHash);
    return Promise.resolve(token === undefined ? null : this.findLiveSync(token.connectionId));
  }

  findRefreshToken(tokenHash: string): Promise<StoredRefreshToken | null> {
    const token = this.tokens.find(
      (candidate) => candidate.tokenHash === tokenHash && candidate.kind === 'refresh',
    );
    return Promise.resolve(
      token === undefined
        ? null
        : {
            id: token.id,
            connectionId: token.connectionId,
            expiresAt: token.expiresAt,
            rotatedAt: token.rotatedAt,
          },
    );
  }

  markRefreshTokenRotated(tokenId: string, rotatedAt: Date): Promise<boolean> {
    const token = this.tokens.find(
      (candidate) => candidate.id === tokenId && candidate.rotatedAt === null,
    );
    if (token === undefined) {
      return Promise.resolve(false);
    }
    token.rotatedAt = rotatedAt;
    return Promise.resolve(true);
  }

  listLiveOf(adminUserId: string, idleCutoff: Date): Promise<readonly OAuthConnection[]> {
    return Promise.resolve(
      this.connections
        .filter(
          (entry) =>
            entry.connection.adminUserId === adminUserId &&
            entry.revokedAt === null &&
            entry.connection.lastUsedAt.getTime() > idleCutoff.getTime(),
        )
        .map((entry) => entry.connection)
        .reverse(),
    );
  }

  touch(connectionId: string, usedAt: Date): Promise<void> {
    for (const entry of this.connections) {
      if (entry.connection.id === connectionId) {
        entry.connection = { ...entry.connection, lastUsedAt: usedAt };
      }
    }
    return Promise.resolve();
  }

  revoke(connectionId: string, revokedAt: Date): Promise<boolean> {
    return Promise.resolve(
      this.revokeWhere((entry) => entry.connection.id === connectionId, revokedAt) > 0,
    );
  }

  revokeOneOf(adminUserId: string, connectionId: string, revokedAt: Date): Promise<boolean> {
    return Promise.resolve(
      this.revokeWhere(
        (entry) =>
          entry.connection.id === connectionId && entry.connection.adminUserId === adminUserId,
        revokedAt,
      ) > 0,
    );
  }

  revokeAllOf(adminUserId: string, revokedAt: Date): Promise<number> {
    return Promise.resolve(
      this.revokeWhere((entry) => entry.connection.adminUserId === adminUserId, revokedAt),
    );
  }

  private store(connectionId: string, issuedAt: Date, tokens: readonly NewConnectionToken[]): void {
    for (const token of tokens) {
      this.tokens.push({
        id: `00000000-0000-4000-d000-${String(this.tokens.length + 1).padStart(12, '0')}`,
        connectionId,
        kind: token.kind,
        tokenHash: token.tokenHash,
        createdAt: issuedAt,
        expiresAt: token.expiresAt,
        rotatedAt: null,
      });
    }
  }

  private live(connectionId: string): StoredConnection | undefined {
    return this.connections.find(
      (entry) => entry.connection.id === connectionId && entry.revokedAt === null,
    );
  }

  private findLiveSync(connectionId: string): OAuthConnection | null {
    return this.live(connectionId)?.connection ?? null;
  }

  private revokeWhere(matches: (entry: StoredConnection) => boolean, revokedAt: Date): number {
    const revoked = this.connections.filter((entry) => entry.revokedAt === null && matches(entry));
    for (const entry of revoked) {
      entry.revokedAt = revokedAt;
    }
    return revoked.length;
  }
}

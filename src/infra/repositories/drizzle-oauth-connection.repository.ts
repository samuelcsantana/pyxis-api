import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, getTableColumns, gt, isNull, or, type SQL } from 'drizzle-orm';
import type { OAuthConnection } from '../../domain/entities/oauth-connection.entity';
import type {
  NewConnection,
  NewConnectionToken,
  OAuthConnectionRepository,
  StoredRefreshToken,
} from '../../domain/repositories/oauth-connection.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { insertedRow } from '../database/inserted-row';
import { oauthConnectionTokens, oauthConnections } from '../database/schema/oauth';

type ConnectionRow = typeof oauthConnections.$inferSelect;

function toConnection(row: ConnectionRow): OAuthConnection {
  return {
    id: row.id,
    adminUserId: row.adminUserId,
    clientId: row.clientId,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
  };
}

function tokenRows(connectionId: string, issuedAt: Date, tokens: readonly NewConnectionToken[]) {
  return tokens.map((token) => ({
    connectionId,
    kind: token.kind,
    tokenHash: token.tokenHash,
    createdAt: issuedAt,
    expiresAt: token.expiresAt,
  }));
}

const liveConnection = isNull(oauthConnections.revokedAt);

@Injectable()
export class DrizzleOAuthConnectionRepository implements OAuthConnectionRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  create(
    connection: NewConnection,
    tokens: readonly NewConnectionToken[],
  ): Promise<OAuthConnection> {
    return this.db.transaction(async (transaction) => {
      const row = insertedRow(
        await transaction
          .insert(oauthConnections)
          .values({ ...connection, lastUsedAt: connection.createdAt })
          .returning(),
      );
      await transaction
        .insert(oauthConnectionTokens)
        .values(tokenRows(row.id, connection.createdAt, tokens));
      return toConnection(row);
    });
  }

  async issueTokens(
    connectionId: string,
    issuedAt: Date,
    tokens: readonly NewConnectionToken[],
  ): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await transaction
        .delete(oauthConnectionTokens)
        .where(
          and(
            eq(oauthConnectionTokens.connectionId, connectionId),
            or(eq(oauthConnectionTokens.kind, 'access'), isNull(oauthConnectionTokens.rotatedAt)),
          ),
        );
      await transaction
        .insert(oauthConnectionTokens)
        .values(tokenRows(connectionId, issuedAt, tokens));
    });
  }

  async findLive(connectionId: string): Promise<OAuthConnection | null> {
    return this.firstLive(eq(oauthConnections.id, connectionId));
  }

  async findLiveByAccessToken(tokenHash: string, now: Date): Promise<OAuthConnection | null> {
    return this.firstLiveByToken(
      and(
        eq(oauthConnectionTokens.tokenHash, tokenHash),
        eq(oauthConnectionTokens.kind, 'access'),
        gt(oauthConnectionTokens.expiresAt, now),
      ),
    );
  }

  async findLiveByAnyToken(tokenHash: string): Promise<OAuthConnection | null> {
    return this.firstLiveByToken(eq(oauthConnectionTokens.tokenHash, tokenHash));
  }

  async findRefreshToken(tokenHash: string): Promise<StoredRefreshToken | null> {
    const [row] = await this.db
      .select({
        id: oauthConnectionTokens.id,
        connectionId: oauthConnectionTokens.connectionId,
        expiresAt: oauthConnectionTokens.expiresAt,
        rotatedAt: oauthConnectionTokens.rotatedAt,
      })
      .from(oauthConnectionTokens)
      .where(
        and(
          eq(oauthConnectionTokens.tokenHash, tokenHash),
          eq(oauthConnectionTokens.kind, 'refresh'),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async markRefreshTokenRotated(tokenId: string, rotatedAt: Date): Promise<boolean> {
    const rotated = await this.db
      .update(oauthConnectionTokens)
      .set({ rotatedAt })
      .where(and(eq(oauthConnectionTokens.id, tokenId), isNull(oauthConnectionTokens.rotatedAt)))
      .returning({ id: oauthConnectionTokens.id });
    return rotated.length > 0;
  }

  async listLiveOf(adminUserId: string, idleCutoff: Date): Promise<readonly OAuthConnection[]> {
    const rows = await this.db
      .select()
      .from(oauthConnections)
      .where(
        and(
          eq(oauthConnections.adminUserId, adminUserId),
          liveConnection,
          gt(oauthConnections.lastUsedAt, idleCutoff),
        ),
      )
      .orderBy(desc(oauthConnections.createdAt), oauthConnections.id);
    return rows.map(toConnection);
  }

  async touch(connectionId: string, usedAt: Date): Promise<void> {
    await this.db
      .update(oauthConnections)
      .set({ lastUsedAt: usedAt })
      .where(eq(oauthConnections.id, connectionId));
  }

  async revoke(connectionId: string, revokedAt: Date): Promise<boolean> {
    return (await this.revokeWhere(eq(oauthConnections.id, connectionId), revokedAt)) > 0;
  }

  async revokeOneOf(adminUserId: string, connectionId: string, revokedAt: Date): Promise<boolean> {
    const condition = and(
      eq(oauthConnections.id, connectionId),
      eq(oauthConnections.adminUserId, adminUserId),
    );
    return (await this.revokeWhere(condition, revokedAt)) > 0;
  }

  revokeAllOf(adminUserId: string, revokedAt: Date): Promise<number> {
    return this.revokeWhere(eq(oauthConnections.adminUserId, adminUserId), revokedAt);
  }

  private async firstLive(condition: SQL | undefined): Promise<OAuthConnection | null> {
    const [row] = await this.db
      .select()
      .from(oauthConnections)
      .where(and(condition, liveConnection))
      .limit(1);
    return row === undefined ? null : toConnection(row);
  }

  private async firstLiveByToken(condition: SQL | undefined): Promise<OAuthConnection | null> {
    const [row] = await this.db
      .select(getTableColumns(oauthConnections))
      .from(oauthConnectionTokens)
      .innerJoin(oauthConnections, eq(oauthConnections.id, oauthConnectionTokens.connectionId))
      .where(and(condition, liveConnection))
      .limit(1);
    return row === undefined ? null : toConnection(row);
  }

  private async revokeWhere(condition: SQL | undefined, revokedAt: Date): Promise<number> {
    const revoked = await this.db
      .update(oauthConnections)
      .set({ revokedAt })
      .where(and(condition, liveConnection))
      .returning({ id: oauthConnections.id });
    return revoked.length;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import type { AccessToken } from '../../domain/entities/access-token.entity';
import type {
  AccessTokenRepository,
  NewAccessToken,
} from '../../domain/repositories/access-token.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { insertedRow } from '../database/inserted-row';
import { adminAccessTokens } from '../database/schema/admins';

type AccessTokenRow = typeof adminAccessTokens.$inferSelect;

function toAccessToken(row: AccessTokenRow): AccessToken {
  return {
    id: row.id,
    adminUserId: row.adminUserId,
    name: row.name,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
  };
}

@Injectable()
export class DrizzleAccessTokenRepository implements AccessTokenRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async create(token: NewAccessToken): Promise<AccessToken> {
    const row = insertedRow(
      await this.db
        .insert(adminAccessTokens)
        .values({
          adminUserId: token.adminUserId,
          name: token.name,
          tokenHash: token.tokenHash,
          createdAt: token.createdAt,
          expiresAt: token.expiresAt,
        })
        .returning(),
    );
    return toAccessToken(row);
  }

  async findLiveByTokenHash(tokenHash: string): Promise<AccessToken | null> {
    const [row] = await this.db
      .select()
      .from(adminAccessTokens)
      .where(and(eq(adminAccessTokens.tokenHash, tokenHash), isNull(adminAccessTokens.revokedAt)))
      .limit(1);
    return row === undefined ? null : toAccessToken(row);
  }

  async listLiveOf(adminUserId: string, now: Date): Promise<readonly AccessToken[]> {
    const rows = await this.db
      .select()
      .from(adminAccessTokens)
      .where(
        and(
          eq(adminAccessTokens.adminUserId, adminUserId),
          isNull(adminAccessTokens.revokedAt),
          gt(adminAccessTokens.expiresAt, now),
        ),
      )
      .orderBy(desc(adminAccessTokens.createdAt), adminAccessTokens.id);
    return rows.map(toAccessToken);
  }

  async touch(tokenId: string, usedAt: Date): Promise<void> {
    await this.db
      .update(adminAccessTokens)
      .set({ lastUsedAt: usedAt })
      .where(eq(adminAccessTokens.id, tokenId));
  }

  async revokeOneOf(adminUserId: string, tokenId: string, revokedAt: Date): Promise<boolean> {
    const revoked = await this.db
      .update(adminAccessTokens)
      .set({ revokedAt })
      .where(
        and(
          eq(adminAccessTokens.id, tokenId),
          eq(adminAccessTokens.adminUserId, adminUserId),
          isNull(adminAccessTokens.revokedAt),
        ),
      )
      .returning({ id: adminAccessTokens.id });
    return revoked.length > 0;
  }

  async revokeAllOf(adminUserId: string, revokedAt: Date): Promise<number> {
    const revoked = await this.db
      .update(adminAccessTokens)
      .set({ revokedAt })
      .where(
        and(eq(adminAccessTokens.adminUserId, adminUserId), isNull(adminAccessTokens.revokedAt)),
      )
      .returning({ id: adminAccessTokens.id });
    return revoked.length;
  }

  async revoke(tokenId: string, revokedAt: Date): Promise<boolean> {
    const revoked = await this.db
      .update(adminAccessTokens)
      .set({ revokedAt })
      .where(and(eq(adminAccessTokens.id, tokenId), isNull(adminAccessTokens.revokedAt)))
      .returning({ id: adminAccessTokens.id });
    return revoked.length > 0;
  }
}

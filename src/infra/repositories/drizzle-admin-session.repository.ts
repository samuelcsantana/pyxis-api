import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { AdminSession } from '../../domain/entities/admin-session.entity';
import type {
  AdminSessionRepository,
  NewAdminSession,
} from '../../domain/repositories/admin-session.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { insertedRow } from '../database/inserted-row';
import { adminSessions } from '../database/schema/admins';

type AdminSessionRow = typeof adminSessions.$inferSelect;

function toAdminSession(row: AdminSessionRow): AdminSession {
  return {
    id: row.id,
    adminUserId: row.adminUserId,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
  };
}

@Injectable()
export class DrizzleAdminSessionRepository implements AdminSessionRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async create(session: NewAdminSession): Promise<AdminSession> {
    const row = insertedRow(
      await this.db
        .insert(adminSessions)
        .values({ ...session, lastUsedAt: session.createdAt })
        .returning(),
    );
    return toAdminSession(row);
  }

  async findLiveByTokenHash(tokenHash: string): Promise<AdminSession | null> {
    const [row] = await this.db
      .select()
      .from(adminSessions)
      .where(and(eq(adminSessions.tokenHash, tokenHash), isNull(adminSessions.revokedAt)))
      .limit(1);
    return row === undefined ? null : toAdminSession(row);
  }

  async touch(sessionId: string, usedAt: Date): Promise<void> {
    await this.db
      .update(adminSessions)
      .set({ lastUsedAt: usedAt })
      .where(eq(adminSessions.id, sessionId));
  }

  async revoke(sessionId: string, revokedAt: Date): Promise<void> {
    await this.db.update(adminSessions).set({ revokedAt }).where(eq(adminSessions.id, sessionId));
  }
}

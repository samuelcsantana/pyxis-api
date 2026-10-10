import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { AdminSession, SessionDevice } from '../../domain/entities/admin-session.entity';
import type {
  AdminSessionRepository,
  NewAdminSession,
} from '../../domain/repositories/admin-session.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { insertedRow } from '../database/inserted-row';
import { adminSessions } from '../database/schema/admins';

type AdminSessionRow = typeof adminSessions.$inferSelect;

function deviceOf(row: AdminSessionRow): SessionDevice | null {
  if (row.deviceType === null || row.browser === null || row.os === null) {
    return null;
  }
  return { deviceType: row.deviceType, browser: row.browser, os: row.os };
}

function toAdminSession(row: AdminSessionRow): AdminSession {
  return {
    id: row.id,
    adminUserId: row.adminUserId,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    device: deviceOf(row),
  };
}

@Injectable()
export class DrizzleAdminSessionRepository implements AdminSessionRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async create(session: NewAdminSession): Promise<AdminSession> {
    const device = session.device ?? null;
    const row = insertedRow(
      await this.db
        .insert(adminSessions)
        .values({
          adminUserId: session.adminUserId,
          tokenHash: session.tokenHash,
          createdAt: session.createdAt,
          lastUsedAt: session.createdAt,
          deviceType: device?.deviceType ?? null,
          browser: device?.browser ?? null,
          os: device?.os ?? null,
        })
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

  async listLiveOf(adminUserId: string): Promise<readonly AdminSession[]> {
    const rows = await this.db
      .select()
      .from(adminSessions)
      .where(and(eq(adminSessions.adminUserId, adminUserId), isNull(adminSessions.revokedAt)))
      .orderBy(desc(adminSessions.lastUsedAt), desc(adminSessions.createdAt), adminSessions.id);
    return rows.map(toAdminSession);
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

  async revokeOneOf(adminUserId: string, sessionId: string, revokedAt: Date): Promise<boolean> {
    const revoked = await this.db
      .update(adminSessions)
      .set({ revokedAt })
      .where(
        and(
          eq(adminSessions.id, sessionId),
          eq(adminSessions.adminUserId, adminUserId),
          isNull(adminSessions.revokedAt),
        ),
      )
      .returning({ id: adminSessions.id });
    return revoked.length > 0;
  }

  async revokeAllOf(adminUserId: string, revokedAt: Date): Promise<number> {
    const revoked = await this.db
      .update(adminSessions)
      .set({ revokedAt })
      .where(and(eq(adminSessions.adminUserId, adminUserId), isNull(adminSessions.revokedAt)))
      .returning({ id: adminSessions.id });
    return revoked.length;
  }
}

import type { AdminSession } from '../entities/admin-session.entity';

export interface NewAdminSession {
  readonly adminUserId: string;
  readonly tokenHash: string;
  readonly createdAt: Date;
}

export interface AdminSessionRepository {
  create(session: NewAdminSession): Promise<AdminSession>;
  findLiveByTokenHash(tokenHash: string): Promise<AdminSession | null>;
  touch(sessionId: string, usedAt: Date): Promise<void>;
  revoke(sessionId: string, revokedAt: Date): Promise<void>;
}

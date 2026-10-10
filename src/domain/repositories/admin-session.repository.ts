import type { AdminSession, SessionDevice } from '../entities/admin-session.entity';

export interface NewAdminSession {
  readonly adminUserId: string;
  readonly tokenHash: string;
  readonly createdAt: Date;
  readonly device?: SessionDevice | null;
}

export interface AdminSessionRepository {
  create(session: NewAdminSession): Promise<AdminSession>;
  findLiveByTokenHash(tokenHash: string): Promise<AdminSession | null>;
  listLiveOf(adminUserId: string): Promise<readonly AdminSession[]>;
  touch(sessionId: string, usedAt: Date): Promise<void>;
  revoke(sessionId: string, revokedAt: Date): Promise<void>;
  revokeOneOf(adminUserId: string, sessionId: string, revokedAt: Date): Promise<boolean>;
  revokeAllOf(adminUserId: string, revokedAt: Date): Promise<number>;
}

export const ADMIN_SESSION_REPOSITORY = Symbol('AdminSessionRepository');

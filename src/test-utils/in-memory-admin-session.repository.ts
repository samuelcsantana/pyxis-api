import type { AdminSession } from '../domain/entities/admin-session.entity';
import type {
  AdminSessionRepository,
  NewAdminSession,
} from '../domain/repositories/admin-session.repository';

interface StoredSession {
  session: AdminSession;
  readonly tokenHash: string;
  revokedAt: Date | null;
}

export class InMemoryAdminSessionRepository implements AdminSessionRepository {
  readonly stored: StoredSession[] = [];

  create(input: NewAdminSession): Promise<AdminSession> {
    const session: AdminSession = {
      id: `00000000-0000-4000-c000-${String(this.stored.length + 1).padStart(12, '0')}`,
      adminUserId: input.adminUserId,
      createdAt: input.createdAt,
      lastUsedAt: input.createdAt,
    };
    this.stored.push({ session, tokenHash: input.tokenHash, revokedAt: null });
    return Promise.resolve(session);
  }

  findLiveByTokenHash(tokenHash: string): Promise<AdminSession | null> {
    const entry = this.stored.find(
      (candidate) => candidate.tokenHash === tokenHash && candidate.revokedAt === null,
    );
    return Promise.resolve(entry?.session ?? null);
  }

  touch(sessionId: string, usedAt: Date): Promise<void> {
    for (const entry of this.stored.filter((candidate) => candidate.session.id === sessionId)) {
      entry.session = { ...entry.session, lastUsedAt: usedAt };
    }
    return Promise.resolve();
  }

  revoke(sessionId: string, revokedAt: Date): Promise<void> {
    for (const entry of this.stored.filter((candidate) => candidate.session.id === sessionId)) {
      entry.revokedAt = revokedAt;
    }
    return Promise.resolve();
  }

  revokeAllOf(adminUserId: string, revokedAt: Date): Promise<number> {
    const live = this.stored.filter(
      (candidate) => candidate.session.adminUserId === adminUserId && candidate.revokedAt === null,
    );
    for (const entry of live) {
      entry.revokedAt = revokedAt;
    }
    return Promise.resolve(live.length);
  }
}

import { isAccessTokenActive } from '../domain/auth/access-token-policy';
import type { AccessToken } from '../domain/entities/access-token.entity';
import type {
  AccessTokenRepository,
  NewAccessToken,
} from '../domain/repositories/access-token.repository';

interface StoredAccessToken {
  token: AccessToken;
  readonly tokenHash: string;
  revokedAt: Date | null;
}

export class InMemoryAccessTokenRepository implements AccessTokenRepository {
  readonly stored: StoredAccessToken[] = [];

  create(input: NewAccessToken): Promise<AccessToken> {
    const token: AccessToken = {
      id: `00000000-0000-4000-d000-${String(this.stored.length + 1).padStart(12, '0')}`,
      adminUserId: input.adminUserId,
      name: input.name,
      createdAt: input.createdAt,
      lastUsedAt: null,
      expiresAt: input.expiresAt,
    };
    this.stored.push({ token, tokenHash: input.tokenHash, revokedAt: null });
    return Promise.resolve(token);
  }

  findLiveByTokenHash(tokenHash: string): Promise<AccessToken | null> {
    const entry = this.stored.find(
      (candidate) => candidate.tokenHash === tokenHash && candidate.revokedAt === null,
    );
    return Promise.resolve(entry?.token ?? null);
  }

  listLiveOf(adminUserId: string, now: Date): Promise<readonly AccessToken[]> {
    return Promise.resolve(
      this.stored
        .filter(
          (entry) =>
            entry.token.adminUserId === adminUserId &&
            entry.revokedAt === null &&
            isAccessTokenActive(entry.token, now),
        )
        .map((entry) => entry.token)
        .reverse(),
    );
  }

  touch(tokenId: string, usedAt: Date): Promise<void> {
    for (const entry of this.stored) {
      if (entry.token.id === tokenId) {
        entry.token = { ...entry.token, lastUsedAt: usedAt };
      }
    }
    return Promise.resolve();
  }

  revokeOneOf(adminUserId: string, tokenId: string, revokedAt: Date): Promise<boolean> {
    const entry = this.stored.find(
      (candidate) =>
        candidate.token.id === tokenId &&
        candidate.token.adminUserId === adminUserId &&
        candidate.revokedAt === null,
    );
    if (entry === undefined) {
      return Promise.resolve(false);
    }
    entry.revokedAt = revokedAt;
    return Promise.resolve(true);
  }
}

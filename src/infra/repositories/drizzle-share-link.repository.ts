import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import type {
  NewShareLink,
  ShareLinkCreation,
  ShareLinkRepository,
} from '../../domain/repositories/share-link.repository';
import type { ShareLink } from '../../domain/share-links/share-link';
import type { UnlockFailures } from '../../domain/share-links/share-unlock';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { aggregateRow, insertedRow } from '../database/inserted-row';
import { projects } from '../database/schema/projects';
import { shareLinks, shareLinkUnlocks } from '../database/schema/share-links';

const shareLinkFields = {
  id: shareLinks.id,
  projectId: shareLinks.projectId,
  name: shareLinks.name,
  createdAt: shareLinks.createdAt,
  expiresAt: shareLinks.expiresAt,
  passwordProtected: sql<boolean>`${shareLinks.passwordHash} IS NOT NULL`,
};

const NO_FAILURES: UnlockFailures = { count: 0, since: null };

function ofProject(projectId: string, linkId: string) {
  return and(eq(shareLinks.id, linkId), eq(shareLinks.projectId, projectId));
}

@Injectable()
export class DrizzleShareLinkRepository implements ShareLinkRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  create(link: NewShareLink, limit: number): Promise<ShareLinkCreation> {
    return this.db.transaction(async (transaction) => {
      await transaction
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, link.projectId))
        .for('update');
      const held = aggregateRow(
        await transaction
          .select({ total: count() })
          .from(shareLinks)
          .where(eq(shareLinks.projectId, link.projectId)),
      );
      if (held.total >= limit) {
        return { outcome: 'limit_reached' };
      }
      const created: ShareLink = insertedRow(
        await transaction
          .insert(shareLinks)
          .values({
            projectId: link.projectId,
            name: link.name,
            tokenHash: link.tokenHash,
            passwordHash: link.passwordHash,
            createdAt: link.createdAt,
            expiresAt: link.expiresAt,
          })
          .returning(shareLinkFields),
      );
      return { outcome: 'created', link: created };
    });
  }

  listByProject(projectId: string): Promise<readonly ShareLink[]> {
    return this.db
      .select(shareLinkFields)
      .from(shareLinks)
      .where(eq(shareLinks.projectId, projectId))
      .orderBy(asc(shareLinks.createdAt), asc(shareLinks.id));
  }

  async findByTokenHash(tokenHash: string): Promise<ShareLink | null> {
    const [row] = await this.db
      .select(shareLinkFields)
      .from(shareLinks)
      .where(eq(shareLinks.tokenHash, tokenHash))
      .limit(1);
    return row ?? null;
  }

  async delete(projectId: string, linkId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(shareLinks)
      .where(ofProject(projectId, linkId))
      .returning({ id: shareLinks.id });
    return deleted.length > 0;
  }

  setPassword(
    projectId: string,
    linkId: string,
    passwordHash: string | null,
  ): Promise<ShareLink | null> {
    return this.db.transaction(async (transaction) => {
      const [row] = await transaction
        .update(shareLinks)
        .set({ passwordHash, failedUnlocks: 0, failedUnlocksSince: null })
        .where(ofProject(projectId, linkId))
        .returning(shareLinkFields);
      if (row === undefined) {
        return null;
      }
      await transaction.delete(shareLinkUnlocks).where(eq(shareLinkUnlocks.shareLinkId, linkId));
      return row;
    });
  }

  async passwordHashOf(linkId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ passwordHash: shareLinks.passwordHash })
      .from(shareLinks)
      .where(eq(shareLinks.id, linkId))
      .limit(1);
    return row?.passwordHash ?? null;
  }

  async unlockFailuresOf(linkId: string): Promise<UnlockFailures> {
    const [row] = await this.db
      .select({ count: shareLinks.failedUnlocks, since: shareLinks.failedUnlocksSince })
      .from(shareLinks)
      .where(eq(shareLinks.id, linkId))
      .limit(1);
    return row ?? NO_FAILURES;
  }

  async recordUnlockFailure(linkId: string, at: Date, windowMs: number): Promise<void> {
    const windowStart = new Date(at.getTime() - windowMs).toISOString();
    const stale = sql`${shareLinks.failedUnlocksSince} IS NULL
      OR ${shareLinks.failedUnlocksSince} <= ${windowStart}::timestamptz`;
    await this.db
      .update(shareLinks)
      .set({
        failedUnlocks: sql`CASE WHEN ${stale} THEN 1 ELSE ${shareLinks.failedUnlocks} + 1 END`,
        failedUnlocksSince: sql`CASE WHEN ${stale} THEN ${at.toISOString()}::timestamptz
          ELSE ${shareLinks.failedUnlocksSince} END`,
      })
      .where(eq(shareLinks.id, linkId));
  }
}

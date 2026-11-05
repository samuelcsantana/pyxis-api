import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq } from 'drizzle-orm';
import type {
  NewShareLink,
  ShareLinkCreation,
  ShareLinkRepository,
} from '../../domain/repositories/share-link.repository';
import type { ShareLink } from '../../domain/share-links/share-link';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { aggregateRow, insertedRow } from '../database/inserted-row';
import { projects } from '../database/schema/projects';
import { shareLinks } from '../database/schema/share-links';

const shareLinkFields = {
  id: shareLinks.id,
  projectId: shareLinks.projectId,
  name: shareLinks.name,
  createdAt: shareLinks.createdAt,
  expiresAt: shareLinks.expiresAt,
};

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
      .where(and(eq(shareLinks.id, linkId), eq(shareLinks.projectId, projectId)))
      .returning({ id: shareLinks.id });
    return deleted.length > 0;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, lte } from 'drizzle-orm';
import type { ShareUnlockRepository } from '../../domain/repositories/share-link.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { shareLinkUnlocks } from '../database/schema/share-links';

@Injectable()
export class DrizzleShareUnlockRepository implements ShareUnlockRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async issue(linkId: string, tokenHash: string, issuedAt: Date, expiresAt: Date): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await transaction
        .delete(shareLinkUnlocks)
        .where(
          and(eq(shareLinkUnlocks.shareLinkId, linkId), lte(shareLinkUnlocks.expiresAt, issuedAt)),
        );
      await transaction
        .insert(shareLinkUnlocks)
        .values({ shareLinkId: linkId, tokenHash, createdAt: issuedAt, expiresAt });
    });
  }

  async isLive(linkId: string, tokenHash: string, now: Date): Promise<boolean> {
    const live = await this.db.$count(
      shareLinkUnlocks,
      and(
        eq(shareLinkUnlocks.shareLinkId, linkId),
        eq(shareLinkUnlocks.tokenHash, tokenHash),
        gt(shareLinkUnlocks.expiresAt, now),
      ),
    );
    return live > 0;
  }
}

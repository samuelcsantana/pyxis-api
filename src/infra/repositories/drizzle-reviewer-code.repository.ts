import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import type { ReviewerCode } from '../../domain/entities/reviewer-code.entity';
import type {
  NewReviewerCode,
  ReviewerCodeRepository,
} from '../../domain/repositories/reviewer-code.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { insertedRow } from '../database/inserted-row';
import { reviewerCodes } from '../database/schema/admins';

type ReviewerCodeRow = typeof reviewerCodes.$inferSelect;

function toReviewerCode(row: ReviewerCodeRow): ReviewerCode {
  return {
    adminUserId: row.adminUserId,
    codeHash: row.codeHash,
    failedAttempts: row.failedAttempts,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

@Injectable()
export class DrizzleReviewerCodeRepository implements ReviewerCodeRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async open(code: NewReviewerCode): Promise<ReviewerCode> {
    const opened = { ...code, failedAttempts: 0 };
    return toReviewerCode(
      insertedRow(
        await this.db
          .insert(reviewerCodes)
          .values(opened)
          .onConflictDoUpdate({ target: reviewerCodes.adminUserId, set: opened })
          .returning(),
      ),
    );
  }

  async findLive(adminUserId: string, now: Date): Promise<ReviewerCode | null> {
    const [row] = await this.db
      .select()
      .from(reviewerCodes)
      .where(and(eq(reviewerCodes.adminUserId, adminUserId), gt(reviewerCodes.expiresAt, now)))
      .limit(1);
    return row === undefined ? null : toReviewerCode(row);
  }

  async reserveAttempt(
    adminUserId: string,
    now: Date,
    maxFailures: number,
  ): Promise<ReviewerCode | null> {
    const [row] = await this.db
      .update(reviewerCodes)
      .set({ failedAttempts: sql`${reviewerCodes.failedAttempts} + 1` })
      .where(
        and(
          eq(reviewerCodes.adminUserId, adminUserId),
          gt(reviewerCodes.expiresAt, now),
          lt(reviewerCodes.failedAttempts, maxFailures),
        ),
      )
      .returning();
    return row === undefined ? null : toReviewerCode(row);
  }

  async releaseAttempt(adminUserId: string): Promise<void> {
    await this.db
      .update(reviewerCodes)
      .set({ failedAttempts: sql`${reviewerCodes.failedAttempts} - 1` })
      .where(and(eq(reviewerCodes.adminUserId, adminUserId), gt(reviewerCodes.failedAttempts, 0)));
  }

  async close(adminUserId: string): Promise<boolean> {
    const closed = await this.db
      .delete(reviewerCodes)
      .where(eq(reviewerCodes.adminUserId, adminUserId))
      .returning({ adminUserId: reviewerCodes.adminUserId });
    return closed.length > 0;
  }
}

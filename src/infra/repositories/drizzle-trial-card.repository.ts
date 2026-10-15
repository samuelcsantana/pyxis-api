import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, ne } from 'drizzle-orm';
import type { TrialCard } from '../../domain/billing/trial-card';
import type { TrialCardRepository } from '../../domain/repositories/trial-card.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { trialCards } from '../database/schema/accounts';

@Injectable()
export class DrizzleTrialCardRepository implements TrialCardRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async record(card: TrialCard): Promise<boolean> {
    const inserted = await this.db
      .insert(trialCards)
      .values(card)
      .onConflictDoNothing()
      .returning({ accountId: trialCards.accountId });
    return inserted.length > 0;
  }

  async otherAccountIds(fingerprint: string, accountId: string): Promise<readonly string[]> {
    const rows = await this.db
      .select({ accountId: trialCards.accountId })
      .from(trialCards)
      .where(and(eq(trialCards.fingerprint, fingerprint), ne(trialCards.accountId, accountId)))
      .orderBy(asc(trialCards.trialStartedAt));
    return rows.map((row) => row.accountId);
  }
}

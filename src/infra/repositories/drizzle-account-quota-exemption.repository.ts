import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Account } from '../../domain/entities/account.entity';
import type { AccountQuotaExemptionRepository } from '../../domain/repositories/account-quota-exemption.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { accounts } from '../database/schema/accounts';
import { toAccount } from './drizzle-account.repository';

@Injectable()
export class DrizzleAccountQuotaExemptionRepository implements AccountQuotaExemptionRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async exemptFromPause(accountId: string, until: Date): Promise<Account | null> {
    const [row] = await this.db
      .update(accounts)
      .set({ quotaPauseExemptUntil: until, ingestionPausedUntil: null })
      .where(eq(accounts.id, accountId))
      .returning();
    return row === undefined ? null : toAccount(row);
  }

  async endPauseExemption(accountId: string): Promise<Account | null> {
    const [row] = await this.db
      .update(accounts)
      .set({ quotaPauseExemptUntil: null })
      .where(eq(accounts.id, accountId))
      .returning();
    return row === undefined ? null : toAccount(row);
  }
}

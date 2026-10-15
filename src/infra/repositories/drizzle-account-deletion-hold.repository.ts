import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Account } from '../../domain/entities/account.entity';
import type { AccountDeletionHoldRepository } from '../../domain/repositories/account-deletion-hold.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { accounts } from '../database/schema/accounts';
import { toAccount } from './drizzle-account.repository';

@Injectable()
export class DrizzleAccountDeletionHoldRepository implements AccountDeletionHoldRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async hold(accountId: string, reason: string, at: Date): Promise<Account | null> {
    const [row] = await this.db
      .update(accounts)
      .set({ deletionHeldAt: at, deletionHoldReason: reason })
      .where(eq(accounts.id, accountId))
      .returning();
    return row === undefined ? null : toAccount(row);
  }

  async release(accountId: string): Promise<Account | null> {
    const [row] = await this.db
      .update(accounts)
      .set({ deletionHeldAt: null, deletionHoldReason: null })
      .where(eq(accounts.id, accountId))
      .returning();
    return row === undefined ? null : toAccount(row);
  }
}

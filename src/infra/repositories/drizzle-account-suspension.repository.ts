import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Account } from '../../domain/entities/account.entity';
import type { AccountSuspensionRepository } from '../../domain/repositories/account-suspension.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { accounts } from '../database/schema/accounts';
import { toAccount } from './drizzle-account.repository';

@Injectable()
export class DrizzleAccountSuspensionRepository implements AccountSuspensionRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async suspend(accountId: string, reason: string, at: Date): Promise<Account | null> {
    const [row] = await this.db
      .update(accounts)
      .set({ suspendedAt: at, suspensionReason: reason })
      .where(eq(accounts.id, accountId))
      .returning();
    return row === undefined ? null : toAccount(row);
  }

  async resume(accountId: string): Promise<Account | null> {
    const [row] = await this.db
      .update(accounts)
      .set({ suspendedAt: null, suspensionReason: null })
      .where(eq(accounts.id, accountId))
      .returning();
    return row === undefined ? null : toAccount(row);
  }
}

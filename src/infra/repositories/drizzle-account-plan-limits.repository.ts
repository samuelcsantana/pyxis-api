import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { PlanLimitChanges } from '../../domain/accounts/account-limits';
import type { Account } from '../../domain/entities/account.entity';
import type { AccountPlanLimitsRepository } from '../../domain/repositories/account-plan-limits.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { accounts } from '../database/schema/accounts';
import { toAccount } from './drizzle-account.repository';

@Injectable()
export class DrizzleAccountPlanLimitsRepository implements AccountPlanLimitsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async setPlanLimits(accountId: string, changes: PlanLimitChanges): Promise<Account | null> {
    const [row] = await this.db
      .update(accounts)
      .set(changes)
      .where(eq(accounts.id, accountId))
      .returning();
    return row === undefined ? null : toAccount(row);
  }
}

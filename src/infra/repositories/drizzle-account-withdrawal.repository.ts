import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { AccountWithdrawalRepository } from '../../domain/repositories/account-withdrawal.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { accounts } from '../database/schema/accounts';

@Injectable()
export class DrizzleAccountWithdrawalRepository implements AccountWithdrawalRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async subscriptionOf(accountId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ subscriptionId: accounts.stripeSubscriptionId })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);
    return row?.subscriptionId ?? null;
  }

  async returnToFreePlan(accountId: string): Promise<void> {
    await this.db
      .update(accounts)
      .set({
        status: 'free',
        stripeSubscriptionId: null,
        billingInterval: null,
        trialEndsAt: null,
        currentPeriodEndsAt: null,
        accessEndsAt: null,
        keysRevokedAt: null,
        endedNotifiedAt: null,
        deletionRemindedAt: null,
        subscriptionConfirmationDueAt: null,
      })
      .where(eq(accounts.id, accountId));
  }
}

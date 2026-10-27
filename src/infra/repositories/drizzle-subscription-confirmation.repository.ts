import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, isNotNull, type SQL, sql } from 'drizzle-orm';
import type {
  SubscriptionConfirmationRepository,
  SubscriptionConfirmationTarget,
} from '../../domain/repositories/subscription-confirmation.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { accounts, termsAcceptances } from '../database/schema/accounts';
import { adminUsers } from '../database/schema/admins';

const CONFIRMED_STATUSES = ['active', 'past_due', 'ending'] as const;

@Injectable()
export class DrizzleSubscriptionConfirmationRepository implements SubscriptionConfirmationRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async toConfirm(accountId: string): Promise<SubscriptionConfirmationTarget | null> {
    const [target] = await this.targets(eq(accounts.id, accountId));
    return target ?? null;
  }

  pendingConfirmations(): Promise<readonly SubscriptionConfirmationTarget[]> {
    return this.targets(sql`true`);
  }

  async markConfirmed(accountId: string): Promise<void> {
    await this.db
      .update(accounts)
      .set({ subscriptionConfirmationDueAt: null })
      .where(eq(accounts.id, accountId));
  }

  private targets(condition: SQL): Promise<SubscriptionConfirmationTarget[]> {
    const latestVersion = this.db
      .select({ version: termsAcceptances.version })
      .from(termsAcceptances)
      .where(eq(termsAcceptances.accountId, accounts.id))
      .orderBy(desc(termsAcceptances.acceptedAt))
      .limit(1);
    return this.db
      .select({
        accountId: accounts.id,
        ownerEmail: adminUsers.email,
        ownerLanguage: adminUsers.emailLanguage,
        billingInterval: accounts.billingInterval,
        termsVersion: sql<string | null>`(${latestVersion})`,
      })
      .from(accounts)
      .innerJoin(adminUsers, eq(adminUsers.id, accounts.ownerAdminId))
      .where(
        and(
          isNotNull(accounts.subscriptionConfirmationDueAt),
          inArray(accounts.status, [...CONFIRMED_STATUSES]),
          condition,
        ),
      );
  }
}

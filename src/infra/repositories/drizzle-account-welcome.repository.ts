import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, exists, inArray, isNull, type SQL, sql } from 'drizzle-orm';
import type {
  AccountWelcomeRepository,
  WelcomeTarget,
} from '../../domain/repositories/account-welcome.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { accounts, termsAcceptances } from '../database/schema/accounts';
import { adminUsers } from '../database/schema/admins';

const STATUSES_WITH_ACCESS = ['trialing', 'active', 'past_due', 'ending'] as const;

@Injectable()
export class DrizzleAccountWelcomeRepository implements AccountWelcomeRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async toWelcome(accountId: string): Promise<WelcomeTarget | null> {
    const [target] = await this.targets(eq(accounts.id, accountId));
    return target ?? null;
  }

  pendingWelcomes(): Promise<readonly WelcomeTarget[]> {
    return this.targets(
      exists(
        this.db
          .select({ id: termsAcceptances.id })
          .from(termsAcceptances)
          .where(eq(termsAcceptances.accountId, accounts.id)),
      ),
    );
  }

  async markWelcomed(accountId: string, at: Date): Promise<void> {
    await this.db.update(accounts).set({ welcomedAt: at }).where(eq(accounts.id, accountId));
  }

  private targets(condition: SQL): Promise<WelcomeTarget[]> {
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
        status: accounts.status,
        trialEndsAt: accounts.trialEndsAt,
        termsVersion: sql<string | null>`(${latestVersion})`,
      })
      .from(accounts)
      .innerJoin(adminUsers, eq(adminUsers.id, accounts.ownerAdminId))
      .where(
        and(
          isNull(accounts.welcomedAt),
          inArray(accounts.status, [...STATUSES_WITH_ACCESS]),
          condition,
        ),
      );
  }
}

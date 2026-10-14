import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, gte, lt, sql } from 'drizzle-orm';
import type { AccountMonthUsage } from '../../domain/accounts/account-quota';
import type {
  AccountUsageEntry,
  AccountUsageRepository,
  RecordedUsage,
} from '../../domain/repositories/account-usage.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { accountUsageMonths, accounts } from '../database/schema/accounts';
import { adminUsers } from '../database/schema/admins';
import { events } from '../database/schema/events';
import { projects } from '../database/schema/projects';

@Injectable()
export class DrizzleAccountUsageRepository implements AccountUsageRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async measure(month: string, from: Date, to: Date): Promise<readonly AccountMonthUsage[]> {
    const rows = await this.db
      .select({
        accountId: accounts.id,
        status: accounts.status,
        events: count(events.id),
        ownerEmail: adminUsers.email,
        ownerLanguage: adminUsers.emailLanguage,
        notifiedLevel: sql<number>`coalesce(${accountUsageMonths.notifiedLevel}, 0)`,
      })
      .from(accounts)
      .innerJoin(adminUsers, eq(adminUsers.id, accounts.ownerAdminId))
      .leftJoin(
        accountUsageMonths,
        and(eq(accountUsageMonths.accountId, accounts.id), eq(accountUsageMonths.month, month)),
      )
      .leftJoin(projects, eq(projects.accountId, accounts.id))
      .leftJoin(
        events,
        and(
          eq(events.projectId, projects.id),
          gte(events.occurredAt, from),
          lt(events.occurredAt, to),
        ),
      )
      .groupBy(accounts.id, adminUsers.id, accountUsageMonths.accountId, accountUsageMonths.month)
      .orderBy(asc(accounts.createdAt), asc(accounts.id));
    return rows.map(({ ownerEmail, ownerLanguage, ...usage }) => ({
      ...usage,
      owner: { email: ownerEmail, language: ownerLanguage },
    }));
  }

  async markNotified(accountId: string, month: string, level: number): Promise<void> {
    await this.db
      .update(accountUsageMonths)
      .set({ notifiedLevel: level })
      .where(and(eq(accountUsageMonths.accountId, accountId), eq(accountUsageMonths.month, month)));
  }

  async record(month: string, entries: readonly AccountUsageEntry[], at: Date): Promise<void> {
    if (entries.length === 0) {
      return;
    }
    await this.db.transaction(async (transaction) => {
      await transaction
        .insert(accountUsageMonths)
        .values(
          entries.map(({ accountId, events: total }) => ({
            accountId,
            month,
            events: total,
            updatedAt: at,
          })),
        )
        .onConflictDoUpdate({
          target: [accountUsageMonths.accountId, accountUsageMonths.month],
          set: { events: sql`excluded.events`, updatedAt: sql`excluded.updated_at` },
        });
      for (const entry of entries) {
        await transaction
          .update(accounts)
          .set({ ingestionPausedUntil: entry.ingestionPausedUntil })
          .where(eq(accounts.id, entry.accountId));
      }
    });
  }

  async recordedFor(accountId: string, month: string): Promise<RecordedUsage | null> {
    const [row] = await this.db
      .select({
        month: accountUsageMonths.month,
        events: accountUsageMonths.events,
        updatedAt: accountUsageMonths.updatedAt,
      })
      .from(accountUsageMonths)
      .where(and(eq(accountUsageMonths.accountId, accountId), eq(accountUsageMonths.month, month)))
      .limit(1);
    return row ?? null;
  }
}

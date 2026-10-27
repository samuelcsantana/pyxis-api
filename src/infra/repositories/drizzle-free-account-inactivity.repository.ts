import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type {
  FreeAccountInactivityRepository,
  FreeAccountToSweep,
} from '../../domain/repositories/free-account-inactivity.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { accounts } from '../database/schema/accounts';
import { adminUsers } from '../database/schema/admins';
import { events } from '../database/schema/events';
import { projects } from '../database/schema/projects';

@Injectable()
export class DrizzleFreeAccountInactivityRepository implements FreeAccountInactivityRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  freeAccounts(): Promise<readonly FreeAccountToSweep[]> {
    const lastEventAt = sql`(
      SELECT max(latest.received_at)
      FROM ${projects}
      CROSS JOIN LATERAL (
        SELECT ${events.receivedAt} AS received_at FROM ${events}
        WHERE ${events.projectId} = ${projects.id}
        ORDER BY ${events.receivedAt} DESC
        LIMIT 1
      ) AS latest
      WHERE ${projects.accountId} = ${accounts.id}
    )`.mapWith(accounts.createdAt);
    return this.db
      .select({
        accountId: accounts.id,
        ownerAdminId: accounts.ownerAdminId,
        ownerEmail: adminUsers.email,
        ownerLanguage: adminUsers.emailLanguage,
        freeSince: sql`coalesce(${accounts.freeSince}, ${accounts.createdAt})`.mapWith(
          accounts.createdAt,
        ),
        lastEventAt,
        inactivityNotifiedAt: accounts.inactivityNotifiedAt,
      })
      .from(accounts)
      .innerJoin(adminUsers, eq(adminUsers.id, accounts.ownerAdminId))
      .where(
        and(
          eq(accounts.status, 'free'),
          isNull(accounts.deletionHeldAt),
          isNull(accounts.suspendedAt),
        ),
      );
  }

  async markNotified(accountId: string, at: Date): Promise<void> {
    await this.db
      .update(accounts)
      .set({ inactivityNotifiedAt: at })
      .where(eq(accounts.id, accountId));
  }

  async clearNotice(accountId: string): Promise<void> {
    await this.db
      .update(accounts)
      .set({ inactivityNotifiedAt: null })
      .where(eq(accounts.id, accountId));
  }
}

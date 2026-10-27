import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  eq,
  exists,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  not,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import type { StaleIncompleteThresholds } from '../../domain/accounts/account-lifecycle';
import type {
  AccountLifecycleRepository,
  EndedAccount,
  ReconcilableAccount,
  StaleAccount,
} from '../../domain/repositories/account-lifecycle.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { accounts } from '../database/schema/accounts';
import { adminProjectAccess, adminUsers } from '../database/schema/admins';
import { events } from '../database/schema/events';
import { projectKeys } from '../database/schema/project-keys';
import { projects } from '../database/schema/projects';

const STATUSES_TO_RECONCILE = ['trialing', 'active', 'past_due', 'ending'] as const;

@Injectable()
export class DrizzleAccountLifecycleRepository implements AccountLifecycleRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  reconcilable(): Promise<readonly ReconcilableAccount[]> {
    return this.db
      .select({
        accountId: accounts.id,
        status: accounts.status,
        accessEndsAt: accounts.accessEndsAt,
        subscriptionId: sql<string>`${accounts.stripeSubscriptionId}`,
      })
      .from(accounts)
      .where(
        and(
          isNotNull(accounts.stripeSubscriptionId),
          inArray(accounts.status, [...STATUSES_TO_RECONCILE]),
        ),
      );
  }

  revokeKeysOfEndedAccounts(now: Date): Promise<number> {
    return this.db.transaction(async (transaction) => {
      const ended = await transaction
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(
            eq(accounts.status, 'ended'),
            lte(accounts.accessEndsAt, now),
            isNull(accounts.keysRevokedAt),
          ),
        )
        .for('update');
      const accountIds = ended.map((row) => row.id);
      if (accountIds.length === 0) {
        return 0;
      }
      await transaction
        .update(projectKeys)
        .set({ revokedAt: now })
        .where(
          and(
            isNull(projectKeys.revokedAt),
            inArray(
              projectKeys.projectId,
              transaction
                .select({ id: projects.id })
                .from(projects)
                .where(inArray(projects.accountId, accountIds)),
            ),
          ),
        );
      await transaction
        .update(accounts)
        .set({ keysRevokedAt: now })
        .where(inArray(accounts.id, accountIds));
      return accountIds.length;
    });
  }

  endedToNotify(now: Date): Promise<readonly EndedAccount[]> {
    return this.ended(and(lte(accounts.accessEndsAt, now), isNull(accounts.endedNotifiedAt)));
  }

  async markEndedNotified(accountId: string, at: Date): Promise<void> {
    await this.db.update(accounts).set({ endedNotifiedAt: at }).where(eq(accounts.id, accountId));
  }

  dueForReminder(remindBefore: Date, deleteBefore: Date): Promise<readonly EndedAccount[]> {
    return this.ended(
      and(
        lte(accounts.accessEndsAt, remindBefore),
        gt(accounts.accessEndsAt, deleteBefore),
        isNull(accounts.deletionRemindedAt),
        isNull(accounts.deletionHeldAt),
      ),
    );
  }

  async markReminded(accountId: string, at: Date): Promise<void> {
    await this.db
      .update(accounts)
      .set({ deletionRemindedAt: at })
      .where(eq(accounts.id, accountId));
  }

  dueForDeletion(deleteBefore: Date): Promise<readonly EndedAccount[]> {
    return this.ended(
      and(lte(accounts.accessEndsAt, deleteBefore), isNull(accounts.deletionHeldAt)),
    );
  }

  staleIncomplete(thresholds: StaleIncompleteThresholds): Promise<readonly StaleAccount[]> {
    return this.db
      .select({ accountId: accounts.id, ownerAdminId: accounts.ownerAdminId })
      .from(accounts)
      .where(
        and(
          eq(accounts.status, 'incomplete'),
          isNull(accounts.stripeSubscriptionId),
          or(
            and(
              isNull(accounts.freeWaitlistedAt),
              lt(accounts.createdAt, thresholds.createdBefore),
            ),
            lt(accounts.freeWaitlistedAt, thresholds.waitlistedBefore),
          ),
          isNull(accounts.deletionHeldAt),
          not(
            exists(
              this.db
                .select({ id: projects.id })
                .from(projects)
                .where(eq(projects.accountId, accounts.id)),
            ),
          ),
        ),
      );
  }

  async peopleOf(accountId: string): Promise<readonly string[]> {
    const rows = await this.db
      .selectDistinct({ adminUserId: adminProjectAccess.adminUserId })
      .from(adminProjectAccess)
      .innerJoin(projects, eq(projects.id, adminProjectAccess.projectId))
      .where(eq(projects.accountId, accountId));
    return rows.map((row) => row.adminUserId);
  }

  async projectIdsOf(accountId: string): Promise<readonly string[]> {
    const rows = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.accountId, accountId));
    return rows.map((row) => row.id);
  }

  async heldProjectIdsOf(accountId: string): Promise<readonly string[]> {
    const rows = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.accountId, accountId), isNotNull(projects.deletionHeldAt)));
    return rows.map((row) => row.id);
  }

  async deleteEventsOf(projectId: string, limit: number): Promise<number> {
    const deleted = await this.db.execute<{ id: string }>(sql`
      DELETE FROM ${events}
      WHERE ctid IN (
        SELECT ctid FROM ${events} WHERE ${events.projectId} = ${projectId} LIMIT ${limit}
      )
      RETURNING ${events.id}`);
    return deleted.length;
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.db.delete(projects).where(eq(projects.id, projectId));
  }

  async deleteAccount(accountId: string): Promise<void> {
    await this.db.delete(accounts).where(eq(accounts.id, accountId));
  }

  async deleteAdminsLeftWithout(adminUserIds: readonly string[]): Promise<number> {
    if (adminUserIds.length === 0) {
      return 0;
    }
    const deleted = await this.db
      .delete(adminUsers)
      .where(
        and(
          inArray(adminUsers.id, [...adminUserIds]),
          not(
            exists(
              this.db
                .select({ id: adminProjectAccess.projectId })
                .from(adminProjectAccess)
                .where(eq(adminProjectAccess.adminUserId, adminUsers.id)),
            ),
          ),
          not(
            exists(
              this.db
                .select({ id: accounts.id })
                .from(accounts)
                .where(eq(accounts.ownerAdminId, adminUsers.id)),
            ),
          ),
        ),
      )
      .returning({ id: adminUsers.id });
    return deleted.length;
  }

  private ended(condition: SQL | undefined): Promise<readonly EndedAccount[]> {
    return this.db
      .select({
        accountId: accounts.id,
        ownerAdminId: accounts.ownerAdminId,
        ownerEmail: adminUsers.email,
        ownerLanguage: adminUsers.emailLanguage,
        accessEndsAt: sql<Date>`${accounts.accessEndsAt}`.mapWith(accounts.accessEndsAt),
      })
      .from(accounts)
      .innerJoin(adminUsers, eq(adminUsers.id, accounts.ownerAdminId))
      .where(and(eq(accounts.status, 'ended'), condition));
  }
}

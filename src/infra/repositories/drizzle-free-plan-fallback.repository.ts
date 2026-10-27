import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  count,
  countDistinct,
  eq,
  inArray,
  isNotNull,
  lte,
  ne,
  type SQL,
  sql,
} from 'drizzle-orm';
import { ACCOUNT_STATUSES, hasRunningSubscription } from '../../domain/accounts/account-status';
import type { FreePlanFit } from '../../domain/accounts/free-plan-fallback';
import type {
  BackToFreeTarget,
  FitDeadline,
  FreePlanFallbackRepository,
} from '../../domain/repositories/free-plan-fallback.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { aggregateRow } from '../database/inserted-row';
import { accounts, termsAcceptances } from '../database/schema/accounts';
import { adminProjectAccess, adminUsers } from '../database/schema/admins';
import { projects } from '../database/schema/projects';

const RUNNING_SUBSCRIPTION_STATUSES = ACCOUNT_STATUSES.filter(hasRunningSubscription);

@Injectable()
export class DrizzleFreePlanFallbackRepository implements FreePlanFallbackRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async fitOf(accountId: string): Promise<FreePlanFit | null> {
    const [account] = await this.db
      .select({
        ownerAdminId: accounts.ownerAdminId,
        eventsPerMonthLimit: accounts.eventsPerMonthLimit,
        projectsLimit: accounts.projectsLimit,
        peopleLimit: accounts.peopleLimit,
      })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);
    if (account === undefined) {
      return null;
    }
    const [projectCount, peopleCount, acceptances, otherFree] = await Promise.all([
      this.db.select({ projects: count() }).from(projects).where(eq(projects.accountId, accountId)),
      this.db
        .select({ people: countDistinct(adminProjectAccess.adminUserId) })
        .from(adminProjectAccess)
        .innerJoin(projects, eq(projects.id, adminProjectAccess.projectId))
        .where(eq(projects.accountId, accountId)),
      this.db
        .select({ version: termsAcceptances.version })
        .from(termsAcceptances)
        .where(eq(termsAcceptances.accountId, accountId)),
      this.db
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(
            eq(accounts.ownerAdminId, account.ownerAdminId),
            eq(accounts.status, 'free'),
            ne(accounts.id, accountId),
          ),
        )
        .limit(1),
    ]);
    return {
      eventsPerMonthLimit: account.eventsPerMonthLimit,
      projectsLimit: account.projectsLimit,
      peopleLimit: account.peopleLimit,
      projects: aggregateRow(projectCount).projects,
      people: aggregateRow(peopleCount).people,
      acceptedTermsVersions: acceptances.map((acceptance) => acceptance.version),
      ownerHasAnotherFreeAccount: otherFree.length > 0,
    };
  }

  async fallBack(accountId: string, at: Date): Promise<boolean> {
    const moved = await this.db
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
        freePlanFitDueAt: null,
        backToFreeNoticeDueAt: at,
        freeSince: at,
        inactivityNotifiedAt: null,
      })
      .where(
        and(eq(accounts.id, accountId), inArray(accounts.status, RUNNING_SUBSCRIPTION_STATUSES)),
      )
      .returning({ id: accounts.id });
    return moved.length > 0;
  }

  async toNotify(accountId: string): Promise<BackToFreeTarget | null> {
    const [target] = await this.targets(eq(accounts.id, accountId));
    return target ?? null;
  }

  pendingNotices(): Promise<readonly BackToFreeTarget[]> {
    return this.targets(sql`true`);
  }

  async markNotified(accountId: string): Promise<void> {
    await this.db
      .update(accounts)
      .set({ backToFreeNoticeDueAt: null })
      .where(eq(accounts.id, accountId));
  }

  async fitDeadlinesDue(now: Date): Promise<readonly FitDeadline[]> {
    const due = await this.db
      .select({ accountId: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.status, 'free'), lte(accounts.freePlanFitDueAt, now)));
    const deadlines = await Promise.all(
      due.map(async ({ accountId }) => ({ accountId, fit: await this.fitOf(accountId) })),
    );
    return deadlines.filter((deadline): deadline is FitDeadline => deadline.fit !== null);
  }

  async clearFitDeadline(accountId: string): Promise<void> {
    await this.db
      .update(accounts)
      .set({ freePlanFitDueAt: null })
      .where(eq(accounts.id, accountId));
  }

  async endUnfit(accountId: string, at: Date): Promise<void> {
    await this.db
      .update(accounts)
      .set({ status: 'ended', accessEndsAt: at, freePlanFitDueAt: null })
      .where(
        and(
          eq(accounts.id, accountId),
          eq(accounts.status, 'free'),
          isNotNull(accounts.freePlanFitDueAt),
        ),
      );
  }

  private targets(condition: SQL): Promise<BackToFreeTarget[]> {
    return this.db
      .select({
        accountId: accounts.id,
        ownerEmail: adminUsers.email,
        ownerLanguage: adminUsers.emailLanguage,
        eventsPerMonthLimit: accounts.eventsPerMonthLimit,
      })
      .from(accounts)
      .innerJoin(adminUsers, eq(adminUsers.id, accounts.ownerAdminId))
      .where(
        and(isNotNull(accounts.backToFreeNoticeDueAt), eq(accounts.status, 'free'), condition),
      );
  }
}

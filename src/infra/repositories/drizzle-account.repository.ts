import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  ne,
  notExists,
  or,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { type FreePlacement, freePlacementOf } from '../../domain/accounts/free-plan-sign-up';
import type { Account } from '../../domain/entities/account.entity';
import type { Project } from '../../domain/entities/project.entity';
import type {
  AccountMembership,
  AccountOverview,
  AccountRepository,
  ClaimedFreePlace,
  FreePlaceClaim,
  NewAccount,
} from '../../domain/repositories/account.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { aggregateRow, insertedRow } from '../database/inserted-row';
import { type AccountRow, accounts } from '../database/schema/accounts';
import { adminProjectAccess, adminUsers } from '../database/schema/admins';
import { projects } from '../database/schema/projects';
import { toProject } from './drizzle-project.repository';

export function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    ownerAdminId: row.ownerAdminId,
    status: row.status,
    ingestionPausedUntil: row.ingestionPausedUntil,
    stripeCustomerId: row.stripeCustomerId,
    billingInterval: row.billingInterval,
    trialEndsAt: row.trialEndsAt,
    currentPeriodEndsAt: row.currentPeriodEndsAt,
    accessEndsAt: row.accessEndsAt,
    suspendedAt: row.suspendedAt,
    suspensionReason: row.suspensionReason,
    deletionHeldAt: row.deletionHeldAt,
    deletionHoldReason: row.deletionHoldReason,
    quotaPauseExemptUntil: row.quotaPauseExemptUntil,
    freeWaitlistedAt: row.freeWaitlistedAt,
    freePlanFitDueAt: row.freePlanFitDueAt,
    eventsPerMonthLimit: row.eventsPerMonthLimit,
    projectsLimit: row.projectsLimit,
    peopleLimit: row.peopleLimit,
    createdAt: row.createdAt,
  };
}

type DrizzleTransaction = Parameters<Parameters<DrizzleDatabase['transaction']>[0]>[0];

export const FREE_PLACES_LOCK_KEY = 4_901_067;

async function freeAccountCount(
  transaction: DrizzleDatabase | DrizzleTransaction,
): Promise<number> {
  const { free } = aggregateRow(
    await transaction.select({ free: count() }).from(accounts).where(eq(accounts.status, 'free')),
  );
  return free;
}

const HOLDS_A_FREE_PLACE = or(
  eq(accounts.status, 'free'),
  and(eq(accounts.status, 'incomplete'), isNotNull(accounts.freeWaitlistedAt)),
);

async function mailboxHoldsAFreePlace(
  transaction: DrizzleTransaction,
  claim: FreePlaceClaim,
): Promise<boolean> {
  const claimant = alias(adminUsers, 'claimant');
  const [held] = await transaction
    .select({ id: accounts.id })
    .from(accounts)
    .innerJoin(adminUsers, eq(adminUsers.id, accounts.ownerAdminId))
    .innerJoin(claimant, eq(claimant.mailbox, adminUsers.mailbox))
    .where(
      and(
        eq(claimant.id, claim.ownerAdminId),
        HOLDS_A_FREE_PLACE,
        claim.accountId === null ? undefined : ne(accounts.id, claim.accountId),
      ),
    )
    .limit(1);
  return held !== undefined;
}

function newAccountOf(claim: FreePlaceClaim, placement: FreePlacement) {
  const ownerAdminId = claim.ownerAdminId;
  switch (placement) {
    case 'place':
      return { ownerAdminId, status: 'free' as const, freeSince: claim.at };
    case 'waitlist':
      return { ownerAdminId, status: 'incomplete' as const, freeWaitlistedAt: claim.at };
    case 'refuse':
      return { ownerAdminId, status: 'incomplete' as const };
  }
}

function claimChangesOf(claim: FreePlaceClaim, placement: FreePlacement) {
  switch (placement) {
    case 'place':
      return { status: 'free' as const, freeWaitlistedAt: null, freeSince: claim.at };
    case 'waitlist':
      return {
        freeWaitlistedAt: sql`coalesce(${accounts.freeWaitlistedAt}, ${claim.at.toISOString()}::timestamptz)`,
      };
    case 'refuse':
      return null;
  }
}

async function insertClaim(
  transaction: DrizzleTransaction,
  claim: FreePlaceClaim,
  placement: FreePlacement,
): Promise<Account> {
  return toAccount(
    insertedRow(
      await transaction.insert(accounts).values(newAccountOf(claim, placement)).returning(),
    ),
  );
}

async function updateClaim(
  transaction: DrizzleTransaction,
  claim: FreePlaceClaim,
  accountId: string,
  placement: FreePlacement,
): Promise<Account> {
  const changes = claimChangesOf(claim, placement);
  if (changes !== null) {
    const [updated] = await transaction
      .update(accounts)
      .set(changes)
      .where(and(eq(accounts.id, accountId), eq(accounts.status, 'incomplete')))
      .returning();
    if (updated !== undefined) {
      return toAccount(updated);
    }
  }
  const [current] = await transaction.select().from(accounts).where(eq(accounts.id, accountId));
  if (current === undefined) {
    throw new Error('The account claiming a free place no longer exists.');
  }
  return toAccount(current);
}

@Injectable()
export class DrizzleAccountRepository implements AccountRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async create(account: NewAccount): Promise<Account> {
    return toAccount(insertedRow(await this.db.insert(accounts).values(account).returning()));
  }

  claimFreePlace(claim: FreePlaceClaim): Promise<ClaimedFreePlace> {
    return this.db.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(${FREE_PLACES_LOCK_KEY})`);
      const placement = freePlacementOf({
        freeAccounts: await freeAccountCount(transaction),
        freeAccountsMax: claim.freeAccountsMax,
        mailboxHoldsAFreePlace: await mailboxHoldsAFreePlace(transaction, claim),
      });
      const account =
        claim.accountId === null
          ? await insertClaim(transaction, claim, placement)
          : await updateClaim(transaction, claim, claim.accountId, placement);
      return { account, placement };
    });
  }

  freeAccountCount(): Promise<number> {
    return freeAccountCount(this.db);
  }

  openWaitingAccounts(freeAccountsMax: number, at: Date): Promise<number> {
    return this.db.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(${FREE_PLACES_LOCK_KEY})`);
      const places = freeAccountsMax - (await freeAccountCount(transaction));
      if (places <= 0) {
        return 0;
      }
      const freeAccounts = alias(accounts, 'free_account');
      const freeOwners = alias(adminUsers, 'free_owner');
      const freeAccountOfTheMailbox = transaction
        .select({ id: freeAccounts.id })
        .from(freeAccounts)
        .innerJoin(freeOwners, eq(freeOwners.id, freeAccounts.ownerAdminId))
        .where(and(eq(freeAccounts.status, 'free'), eq(freeOwners.mailbox, adminUsers.mailbox)));
      const firstWaitingOfEachMailbox = transaction
        .selectDistinctOn([adminUsers.mailbox], {
          id: accounts.id,
          waitlistedAt: accounts.freeWaitlistedAt,
        })
        .from(accounts)
        .innerJoin(adminUsers, eq(adminUsers.id, accounts.ownerAdminId))
        .where(
          and(
            eq(accounts.status, 'incomplete'),
            isNotNull(accounts.freeWaitlistedAt),
            isNull(accounts.stripeSubscriptionId),
            isNull(accounts.deletionHeldAt),
            isNull(accounts.suspendedAt),
            notExists(freeAccountOfTheMailbox),
          ),
        )
        .orderBy(asc(adminUsers.mailbox), asc(accounts.freeWaitlistedAt), asc(accounts.id))
        .as('first_waiting');
      const oldestWaiting = transaction
        .select({ id: firstWaitingOfEachMailbox.id })
        .from(firstWaitingOfEachMailbox)
        .orderBy(asc(firstWaitingOfEachMailbox.waitlistedAt), asc(firstWaitingOfEachMailbox.id))
        .limit(places);
      const opened = await transaction
        .update(accounts)
        .set({ status: 'free', freeWaitlistedAt: null, freeSince: at })
        .where(inArray(accounts.id, oldestWaiting))
        .returning({ id: accounts.id });
      return opened.length;
    });
  }

  async findById(accountId: string): Promise<Account | null> {
    const [row] = await this.db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
    return row === undefined ? null : toAccount(row);
  }

  async projectsOf(accountId: string): Promise<readonly Project[]> {
    const rows = await this.db
      .select()
      .from(projects)
      .where(eq(projects.accountId, accountId))
      .orderBy(asc(projects.createdAt), asc(projects.id));
    return rows.map(toProject);
  }

  async peopleCount(accountId: string): Promise<number> {
    const { people } = aggregateRow(
      await this.db
        .select({ people: countDistinct(adminProjectAccess.adminUserId) })
        .from(adminProjectAccess)
        .innerJoin(projects, eq(projects.id, adminProjectAccess.projectId))
        .where(eq(projects.accountId, accountId)),
    );
    return people;
  }

  async liveAccountOwnedBy(adminUserId: string): Promise<Account | null> {
    const [row] = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.ownerAdminId, adminUserId), ne(accounts.status, 'ended')))
      .orderBy(desc(accounts.createdAt))
      .limit(1);
    return row === undefined ? null : toAccount(row);
  }

  async membershipsOf(adminUserId: string): Promise<readonly AccountMembership[]> {
    const owned = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.ownerAdminId, adminUserId))
      .orderBy(asc(accounts.createdAt));
    const joined = await this.db
      .selectDistinct({ account: accounts })
      .from(adminProjectAccess)
      .innerJoin(projects, eq(projects.id, adminProjectAccess.projectId))
      .innerJoin(accounts, eq(accounts.id, projects.accountId))
      .where(
        and(
          eq(adminProjectAccess.adminUserId, adminUserId),
          ne(accounts.ownerAdminId, adminUserId),
        ),
      )
      .orderBy(asc(accounts.createdAt));
    return [
      ...owned.map((row) => ({ account: toAccount(row), role: 'owner' as const })),
      ...joined.map((row) => ({ account: toAccount(row.account), role: 'member' as const })),
    ];
  }

  async overviewOf(accountId: string): Promise<AccountOverview | null> {
    const [row] = await this.db
      .select({ account: accounts, ownerEmail: adminUsers.email })
      .from(accounts)
      .innerJoin(adminUsers, eq(adminUsers.id, accounts.ownerAdminId))
      .where(eq(accounts.id, accountId))
      .limit(1);
    if (row === undefined) {
      return null;
    }
    const [projectsHeld, people] = await Promise.all([
      this.projectsOf(accountId),
      this.peopleCount(accountId),
    ]);
    return {
      account: toAccount(row.account),
      ownerEmail: row.ownerEmail,
      projects: projectsHeld,
      people,
    };
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, countDistinct, desc, eq, ne, sql } from 'drizzle-orm';
import type { Account } from '../../domain/entities/account.entity';
import type { Project } from '../../domain/entities/project.entity';
import type {
  AccountMembership,
  AccountOverview,
  AccountRepository,
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
    eventsPerMonthLimit: row.eventsPerMonthLimit,
    projectsLimit: row.projectsLimit,
    peopleLimit: row.peopleLimit,
    createdAt: row.createdAt,
  };
}

type DrizzleTransaction = Parameters<Parameters<DrizzleDatabase['transaction']>[0]>[0];

export const FREE_PLACES_LOCK_KEY = 4_901_067;

async function freeAccountCount(transaction: DrizzleTransaction): Promise<number> {
  const { free } = aggregateRow(
    await transaction.select({ free: count() }).from(accounts).where(eq(accounts.status, 'free')),
  );
  return free;
}

async function insertClaim(
  transaction: DrizzleTransaction,
  claim: FreePlaceClaim,
  hasAPlace: boolean,
): Promise<Account> {
  const values = hasAPlace
    ? { ownerAdminId: claim.ownerAdminId, status: 'free' as const }
    : {
        ownerAdminId: claim.ownerAdminId,
        status: 'incomplete' as const,
        freeWaitlistedAt: claim.at,
      };
  return toAccount(insertedRow(await transaction.insert(accounts).values(values).returning()));
}

async function updateClaim(
  transaction: DrizzleTransaction,
  claim: FreePlaceClaim,
  accountId: string,
  hasAPlace: boolean,
): Promise<Account> {
  const [updated] = await transaction
    .update(accounts)
    .set(
      hasAPlace
        ? { status: 'free', freeWaitlistedAt: null }
        : {
            freeWaitlistedAt: sql`coalesce(${accounts.freeWaitlistedAt}, ${claim.at.toISOString()}::timestamptz)`,
          },
    )
    .where(and(eq(accounts.id, accountId), eq(accounts.status, 'incomplete')))
    .returning();
  if (updated !== undefined) {
    return toAccount(updated);
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

  claimFreePlace(claim: FreePlaceClaim): Promise<Account> {
    return this.db.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(${FREE_PLACES_LOCK_KEY})`);
      const hasAPlace = (await freeAccountCount(transaction)) < claim.freeAccountsMax;
      return claim.accountId === null
        ? insertClaim(transaction, claim, hasAPlace)
        : updateClaim(transaction, claim, claim.accountId, hasAPlace);
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

import { Inject, Injectable } from '@nestjs/common';
import { and, asc, countDistinct, desc, eq, ne } from 'drizzle-orm';
import type { Account } from '../../domain/entities/account.entity';
import type { Project } from '../../domain/entities/project.entity';
import type {
  AccountMembership,
  AccountOverview,
  AccountRepository,
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
    createdAt: row.createdAt,
  };
}

@Injectable()
export class DrizzleAccountRepository implements AccountRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async create(account: NewAccount): Promise<Account> {
    return toAccount(insertedRow(await this.db.insert(accounts).values(account).returning()));
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

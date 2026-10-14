import { Inject, Injectable } from '@nestjs/common';
import { asc, countDistinct, eq } from 'drizzle-orm';
import type { Account } from '../../domain/entities/account.entity';
import type { Project } from '../../domain/entities/project.entity';
import type { AccountRepository, NewAccount } from '../../domain/repositories/account.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { aggregateRow, insertedRow } from '../database/inserted-row';
import { type AccountRow, accounts } from '../database/schema/accounts';
import { adminProjectAccess } from '../database/schema/admins';
import { projects } from '../database/schema/projects';
import { toProject } from './drizzle-project.repository';

export function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    ownerAdminId: row.ownerAdminId,
    status: row.status,
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
}

import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import type {
  AccountPeopleSlot,
  PersonAddition,
  ProjectPeopleRepository,
  ProjectPerson,
} from '../../domain/repositories/project-people.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { insertedRow } from '../database/inserted-row';
import { accounts } from '../database/schema/accounts';
import { adminProjectAccess, adminUsers } from '../database/schema/admins';
import { projects } from '../database/schema/projects';

type DrizzleTransaction = Parameters<Parameters<DrizzleDatabase['transaction']>[0]>[0];

const personColumns = {
  adminUserId: adminUsers.id,
  email: adminUsers.email,
  addedAt: adminProjectAccess.createdAt,
};

async function personIn(
  transaction: DrizzleTransaction,
  projectId: string,
  email: string,
): Promise<ProjectPerson | null> {
  const [row] = await transaction
    .select(personColumns)
    .from(adminProjectAccess)
    .innerJoin(adminUsers, eq(adminUsers.id, adminProjectAccess.adminUserId))
    .where(and(eq(adminProjectAccess.projectId, projectId), eq(adminUsers.email, email)))
    .limit(1);
  return row ?? null;
}

async function peopleOfAccount(
  transaction: DrizzleTransaction,
  accountId: string,
): Promise<ReadonlySet<string>> {
  const rows = await transaction
    .selectDistinct({ email: adminUsers.email })
    .from(adminProjectAccess)
    .innerJoin(projects, eq(projects.id, adminProjectAccess.projectId))
    .innerJoin(adminUsers, eq(adminUsers.id, adminProjectAccess.adminUserId))
    .where(eq(projects.accountId, accountId));
  return new Set(rows.map((row) => row.email));
}

@Injectable()
export class DrizzleProjectPeopleRepository implements ProjectPeopleRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  peopleOf(projectId: string): Promise<readonly ProjectPerson[]> {
    return this.db
      .select(personColumns)
      .from(adminProjectAccess)
      .innerJoin(adminUsers, eq(adminUsers.id, adminProjectAccess.adminUserId))
      .where(eq(adminProjectAccess.projectId, projectId))
      .orderBy(asc(adminProjectAccess.createdAt), asc(adminUsers.email));
  }

  addToAccountProject(
    email: string,
    projectId: string,
    slot: AccountPeopleSlot,
  ): Promise<PersonAddition> {
    return this.db.transaction(async (transaction) => {
      await transaction
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.id, slot.accountId))
        .for('update');
      const present = await personIn(transaction, projectId, email);
      if (present !== null) {
        return { outcome: 'already_there', person: present };
      }
      const people = await peopleOfAccount(transaction, slot.accountId);
      if (!people.has(email) && people.size >= slot.maxPeople) {
        return { outcome: 'people_limit_reached' };
      }
      await transaction.insert(adminUsers).values({ email }).onConflictDoNothing();
      const admin = insertedRow(
        await transaction
          .select({ id: adminUsers.id })
          .from(adminUsers)
          .where(eq(adminUsers.email, email))
          .limit(1),
      );
      const access = insertedRow(
        await transaction
          .insert(adminProjectAccess)
          .values({ adminUserId: admin.id, projectId })
          .returning({ addedAt: adminProjectAccess.createdAt }),
      );
      return {
        outcome: 'added',
        person: { adminUserId: admin.id, email, addedAt: access.addedAt },
      };
    });
  }

  async remove(projectId: string, adminUserId: string): Promise<boolean> {
    const removed = await this.db
      .delete(adminProjectAccess)
      .where(
        and(
          eq(adminProjectAccess.projectId, projectId),
          eq(adminProjectAccess.adminUserId, adminUserId),
        ),
      )
      .returning({ projectId: adminProjectAccess.projectId });
    return removed.length > 0;
  }
}

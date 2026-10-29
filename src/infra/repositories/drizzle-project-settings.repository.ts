import { Inject, Injectable } from '@nestjs/common';
import { count, eq, getTableColumns, sql } from 'drizzle-orm';
import type { Project } from '../../domain/entities/project.entity';
import type {
  AccountProjectSlot,
  CreatedProject,
  DeletedProject,
  NewProject,
  ProjectChanges,
  ProjectInAccount,
  ProjectSettingsRepository,
} from '../../domain/repositories/project-settings.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { aggregateRow, insertedRow } from '../database/inserted-row';
import { accounts } from '../database/schema/accounts';
import { adminProjectAccess } from '../database/schema/admins';
import { events } from '../database/schema/events';
import { projectKeys } from '../database/schema/project-keys';
import { projects } from '../database/schema/projects';
import { toProject } from './drizzle-project.repository';

type DrizzleTransaction = Parameters<Parameters<DrizzleDatabase['transaction']>[0]>[0];

async function insertProjectWithKey(
  transaction: DrizzleTransaction,
  project: NewProject,
  publicKey: string,
  accountId: string | null,
): Promise<CreatedProject> {
  const created = insertedRow(
    await transaction
      .insert(projects)
      .values({ ...project, allowedOrigins: [...project.allowedOrigins], accountId })
      .returning(),
  );
  const key = insertedRow(
    await transaction
      .insert(projectKeys)
      .values({ projectId: created.id, kind: 'public', publicKey })
      .returning({ id: projectKeys.id }),
  );
  return { project: toProject(created), publicKeyId: key.id };
}

function columnChanges(changes: ProjectChanges): Partial<typeof projects.$inferInsert> {
  const { name, allowedOrigins, timezone, conversionEvent, cityEnabled } = changes;
  return {
    ...(name === undefined ? {} : { name }),
    ...(allowedOrigins === undefined ? {} : { allowedOrigins: [...allowedOrigins] }),
    ...(timezone === undefined ? {} : { timezone }),
    ...(conversionEvent === undefined ? {} : { conversionEvent }),
    ...(cityEnabled === undefined ? {} : { cityEnabled }),
  };
}

@Injectable()
export class DrizzleProjectSettingsRepository implements ProjectSettingsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  createWithPublicKey(project: NewProject, publicKey: string): Promise<CreatedProject> {
    return this.db.transaction((transaction) =>
      insertProjectWithKey(transaction, project, publicKey, null),
    );
  }

  createWithPublicKeyInAccount(
    project: NewProject,
    publicKey: string,
    slot: AccountProjectSlot,
  ): Promise<ProjectInAccount> {
    return this.db.transaction(async (transaction) => {
      const [account] = await transaction
        .select({ ownerAdminId: accounts.ownerAdminId })
        .from(accounts)
        .where(eq(accounts.id, slot.accountId))
        .for('update');
      if (account === undefined) {
        return { outcome: 'account_not_found' };
      }
      const held = aggregateRow(
        await transaction
          .select({ total: count() })
          .from(projects)
          .where(eq(projects.accountId, slot.accountId)),
      );
      if (held.total >= slot.maxProjects) {
        return { outcome: 'project_limit_reached' };
      }
      const created = await insertProjectWithKey(transaction, project, publicKey, slot.accountId);
      await transaction
        .insert(adminProjectAccess)
        .values({ adminUserId: account.ownerAdminId, projectId: created.project.id });
      return { outcome: 'created', created };
    });
  }

  async findById(projectId: string): Promise<Project | null> {
    const [row] = await this.db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    return row === undefined ? null : toProject(row);
  }

  async accountIdOf(projectId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ accountId: projects.accountId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    return row?.accountId ?? null;
  }

  async update(projectId: string, changes: ProjectChanges): Promise<Project | null> {
    const values = columnChanges(changes);
    if (Object.keys(values).length === 0) {
      return this.findById(projectId);
    }
    const [row] = await this.db
      .update(projects)
      .set(values)
      .where(eq(projects.id, projectId))
      .returning();
    return row === undefined ? null : toProject(row);
  }

  deleteWithEverything(projectId: string): Promise<DeletedProject | null> {
    return this.db.transaction(async (transaction) => {
      const [found] = await transaction
        .select({
          ...getTableColumns(projects),
          eventCount: sql<number>`(SELECT count(*)::int FROM ${events} WHERE ${events.projectId} = ${projectId})`,
          keyCount: sql<number>`(SELECT count(*)::int FROM ${projectKeys} WHERE ${projectKeys.projectId} = ${projectId})`,
        })
        .from(projects)
        .where(eq(projects.id, projectId))
        .for('update');
      if (found === undefined) {
        return null;
      }
      await transaction.delete(projects).where(eq(projects.id, projectId));
      const { eventCount, keyCount, ...row } = found;
      return { project: toProject(row), deletedEvents: eventCount, deletedKeys: keyCount };
    });
  }
}

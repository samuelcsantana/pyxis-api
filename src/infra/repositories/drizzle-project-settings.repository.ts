import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Project } from '../../domain/entities/project.entity';
import type {
  CreatedProject,
  NewProject,
  ProjectChanges,
  ProjectSettingsRepository,
} from '../../domain/repositories/project-settings.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { insertedRow } from '../database/inserted-row';
import { projectKeys } from '../database/schema/project-keys';
import { projects } from '../database/schema/projects';
import { toProject } from './drizzle-project.repository';

function columnChanges(changes: ProjectChanges): Partial<typeof projects.$inferInsert> {
  const { allowedOrigins, timezone, conversionEvent } = changes;
  return {
    ...(allowedOrigins === undefined ? {} : { allowedOrigins: [...allowedOrigins] }),
    ...(timezone === undefined ? {} : { timezone }),
    ...(conversionEvent === undefined ? {} : { conversionEvent }),
  };
}

@Injectable()
export class DrizzleProjectSettingsRepository implements ProjectSettingsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  createWithPublicKey(project: NewProject, publicKey: string): Promise<CreatedProject> {
    return this.db.transaction(async (transaction) => {
      const created = insertedRow(
        await transaction
          .insert(projects)
          .values({ ...project, allowedOrigins: [...project.allowedOrigins] })
          .returning(),
      );
      const key = insertedRow(
        await transaction
          .insert(projectKeys)
          .values({ projectId: created.id, kind: 'public', publicKey })
          .returning({ id: projectKeys.id }),
      );
      return { project: toProject(created), publicKeyId: key.id };
    });
  }

  async findById(projectId: string): Promise<Project | null> {
    const [row] = await this.db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    return row === undefined ? null : toProject(row);
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
}

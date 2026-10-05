import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { Project } from '../../domain/entities/project.entity';
import type { ProjectRepository } from '../../domain/repositories/project.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { projectKeys } from '../database/schema/project-keys';
import { type ProjectRow, projects } from '../database/schema/projects';

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    allowedOrigins: row.allowedOrigins,
    timezone: row.timezone,
    conversionEvent: row.conversionEvent,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class DrizzleProjectRepository implements ProjectRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async findByPublicKey(publicKey: string): Promise<Project | null> {
    const [row] = await this.db
      .select({ project: projects })
      .from(projectKeys)
      .innerJoin(projects, eq(projectKeys.projectId, projects.id))
      .where(
        and(
          eq(projectKeys.kind, 'public'),
          eq(projectKeys.publicKey, publicKey),
          isNull(projectKeys.revokedAt),
        ),
      )
      .limit(1);
    return row === undefined ? null : toProject(row.project);
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type {
  ProjectIngestionSuspension,
  ProjectSuspensionRepository,
} from '../../domain/repositories/project-suspension.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { projects } from '../database/schema/projects';

const SUSPENSION_COLUMNS = {
  projectId: projects.id,
  projectName: projects.name,
  suspendedAt: projects.ingestionSuspendedAt,
  reason: projects.ingestionSuspensionReason,
};

@Injectable()
export class DrizzleProjectSuspensionRepository implements ProjectSuspensionRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async suspensionOf(projectId: string): Promise<ProjectIngestionSuspension | null> {
    const [row] = await this.db
      .select(SUSPENSION_COLUMNS)
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    return row ?? null;
  }

  async suspend(
    projectId: string,
    reason: string,
    at: Date,
  ): Promise<ProjectIngestionSuspension | null> {
    const [row] = await this.db
      .update(projects)
      .set({ ingestionSuspendedAt: at, ingestionSuspensionReason: reason })
      .where(eq(projects.id, projectId))
      .returning(SUSPENSION_COLUMNS);
    return row ?? null;
  }

  async resume(projectId: string): Promise<ProjectIngestionSuspension | null> {
    const [row] = await this.db
      .update(projects)
      .set({ ingestionSuspendedAt: null, ingestionSuspensionReason: null })
      .where(eq(projects.id, projectId))
      .returning(SUSPENSION_COLUMNS);
    return row ?? null;
  }
}

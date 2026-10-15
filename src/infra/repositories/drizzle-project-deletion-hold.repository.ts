import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type {
  ProjectDeletionHold,
  ProjectDeletionHoldRepository,
} from '../../domain/repositories/project-deletion-hold.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { projects } from '../database/schema/projects';

const HOLD_COLUMNS = {
  projectId: projects.id,
  projectName: projects.name,
  heldAt: projects.deletionHeldAt,
  reason: projects.deletionHoldReason,
};

@Injectable()
export class DrizzleProjectDeletionHoldRepository implements ProjectDeletionHoldRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async holdOf(projectId: string): Promise<ProjectDeletionHold | null> {
    const [row] = await this.db
      .select(HOLD_COLUMNS)
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    return row ?? null;
  }

  async hold(projectId: string, reason: string, at: Date): Promise<ProjectDeletionHold | null> {
    const [row] = await this.db
      .update(projects)
      .set({ deletionHeldAt: at, deletionHoldReason: reason })
      .where(eq(projects.id, projectId))
      .returning(HOLD_COLUMNS);
    return row ?? null;
  }

  async release(projectId: string): Promise<ProjectDeletionHold | null> {
    const [row] = await this.db
      .update(projects)
      .set({ deletionHeldAt: null, deletionHoldReason: null })
      .where(eq(projects.id, projectId))
      .returning(HOLD_COLUMNS);
    return row ?? null;
  }
}

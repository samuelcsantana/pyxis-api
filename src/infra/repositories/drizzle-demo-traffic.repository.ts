import { Inject, Injectable } from '@nestjs/common';
import { eq, max } from 'drizzle-orm';
import type {
  DemoTrafficProject,
  DemoTrafficRepository,
  DemoTrafficTarget,
} from '../../domain/repositories/demo-traffic.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { events } from '../database/schema/events';
import { projects } from '../database/schema/projects';

const demoTrafficProjectColumns = {
  projectId: projects.id,
  projectName: projects.name,
  accountId: projects.accountId,
  demoTraffic: projects.demoTraffic,
};

@Injectable()
export class DrizzleDemoTrafficRepository implements DemoTrafficRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async projectOf(projectId: string): Promise<DemoTrafficProject | null> {
    const [row] = await this.db
      .select(demoTrafficProjectColumns)
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    return row ?? null;
  }

  async mark(projectId: string, demoTraffic: boolean): Promise<DemoTrafficProject | null> {
    const [row] = await this.db
      .update(projects)
      .set({ demoTraffic })
      .where(eq(projects.id, projectId))
      .returning(demoTrafficProjectColumns);
    return row ?? null;
  }

  targets(): Promise<readonly DemoTrafficTarget[]> {
    return this.db
      .select({
        projectId: projects.id,
        timezone: projects.timezone,
        lastEventAt: max(events.occurredAt),
      })
      .from(projects)
      .leftJoin(events, eq(events.projectId, projects.id))
      .where(eq(projects.demoTraffic, true))
      .groupBy(projects.id)
      .orderBy(projects.id);
  }
}

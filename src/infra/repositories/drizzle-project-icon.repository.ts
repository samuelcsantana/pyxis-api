import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import type { SiteIconType } from '../../domain/projects/site-icon';
import type {
  ProjectIcon,
  ProjectIconRepository,
  ProjectSite,
} from '../../domain/repositories/project-icon.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { projectIcons } from '../database/schema/project-icons';
import { projects } from '../database/schema/projects';

const BASE64 = 'base64';

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString(BASE64);
}

function fromBase64(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, BASE64));
}

@Injectable()
export class DrizzleProjectIconRepository implements ProjectIconRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async sites(): Promise<readonly ProjectSite[]> {
    const rows = await this.db
      .select({
        projectId: projects.id,
        origin: sql<string | null>`${projects.allowedOrigins}[1]`,
      })
      .from(projects)
      .orderBy(asc(projects.name), asc(projects.id));
    return rows.flatMap((row) =>
      row.origin === null ? [] : [{ projectId: row.projectId, origin: row.origin }],
    );
  }

  async find(projectId: string): Promise<ProjectIcon | null> {
    const [row] = await this.db
      .select({
        projectId: projectIcons.projectId,
        contentType: projectIcons.contentType,
        bytes: sql<string>`encode(${projectIcons.bytes}, ${BASE64})`,
        version: projectIcons.version,
        sourceUrl: projectIcons.sourceUrl,
        fetchedAt: projectIcons.fetchedAt,
      })
      .from(projectIcons)
      .where(eq(projectIcons.projectId, projectId))
      .limit(1);
    return row === undefined
      ? null
      : {
          ...row,
          contentType: row.contentType as SiteIconType,
          bytes: fromBase64(row.bytes),
        };
  }

  async save(icon: ProjectIcon): Promise<void> {
    const values = {
      contentType: icon.contentType,
      bytes: sql`decode(${toBase64(icon.bytes)}, ${BASE64})`,
      version: icon.version,
      sourceUrl: icon.sourceUrl,
      fetchedAt: icon.fetchedAt,
    };
    await this.db
      .insert(projectIcons)
      .values({ projectId: icon.projectId, ...values })
      .onConflictDoUpdate({ target: projectIcons.projectId, set: values });
  }

  async remove(projectId: string): Promise<void> {
    await this.db.delete(projectIcons).where(eq(projectIcons.projectId, projectId));
  }

  async versionsOf(projectIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    if (projectIds.length === 0) {
      return new Map();
    }
    const rows = await this.db
      .select({ projectId: projectIcons.projectId, version: projectIcons.version })
      .from(projectIcons)
      .where(inArray(projectIcons.projectId, [...projectIds]));
    return new Map(rows.map((row) => [row.projectId, row.version]));
  }
}

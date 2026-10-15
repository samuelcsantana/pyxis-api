import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, gte, lt, sql } from 'drizzle-orm';
import type { ExportCursor, ExportedEvent } from '../../domain/exports/exported-event';
import type { ProjectExport } from '../../domain/exports/project-export';
import type {
  CompletedExport,
  EventExportSource,
  ExportRequest,
  ExportRequestLimits,
  ExportTarget,
  ProjectExportRepository,
} from '../../domain/repositories/project-export.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { aggregateRow, insertedRow } from '../database/inserted-row';
import { adminUsers } from '../database/schema/admins';
import { events } from '../database/schema/events';
import { projectExports } from '../database/schema/exports';
import { projects } from '../database/schema/projects';

type ExportRow = typeof projectExports.$inferSelect;

function toProjectExport(row: ExportRow): ProjectExport {
  return {
    id: row.id,
    projectId: row.projectId,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt,
    status: row.status,
    finishedAt: row.finishedAt,
    objectKey: row.objectKey,
    eventCount: row.eventCount,
  };
}

@Injectable()
export class DrizzleProjectExportRepository implements ProjectExportRepository, EventExportSource {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  request(
    projectId: string,
    requestedBy: string,
    at: Date,
    limits: ExportRequestLimits,
  ): Promise<ExportRequest> {
    return this.db.transaction(async (transaction) => {
      await transaction
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId))
        .for('update');
      const [pending] = await transaction
        .select()
        .from(projectExports)
        .where(and(eq(projectExports.projectId, projectId), eq(projectExports.status, 'pending')))
        .limit(1);
      if (pending !== undefined) {
        return { outcome: 'already_pending', projectExport: toProjectExport(pending) };
      }
      const recent = aggregateRow(
        await transaction
          .select({ total: count() })
          .from(projectExports)
          .where(
            and(
              eq(projectExports.projectId, projectId),
              gte(projectExports.requestedAt, limits.since),
            ),
          ),
      );
      if (recent.total >= limits.perDay) {
        return { outcome: 'daily_limit_reached' };
      }
      const created = insertedRow(
        await transaction
          .insert(projectExports)
          .values({ projectId, requestedBy, requestedAt: at, status: 'pending' })
          .returning(),
      );
      return { outcome: 'requested', projectExport: toProjectExport(created) };
    });
  }

  async findOfProject(projectId: string, exportId: string): Promise<ProjectExport | null> {
    const [row] = await this.db
      .select()
      .from(projectExports)
      .where(and(eq(projectExports.projectId, projectId), eq(projectExports.id, exportId)))
      .limit(1);
    return row === undefined ? null : toProjectExport(row);
  }

  async pendingTarget(exportId: string): Promise<ExportTarget | null> {
    const [row] = await this.db
      .select({
        projectExport: projectExports,
        projectName: projects.name,
        requesterEmail: adminUsers.email,
        requesterLanguage: adminUsers.emailLanguage,
      })
      .from(projectExports)
      .innerJoin(projects, eq(projects.id, projectExports.projectId))
      .leftJoin(adminUsers, eq(adminUsers.id, projectExports.requestedBy))
      .where(and(eq(projectExports.id, exportId), eq(projectExports.status, 'pending')))
      .limit(1);
    if (row === undefined) {
      return null;
    }
    return {
      projectExport: toProjectExport(row.projectExport),
      projectName: row.projectName,
      requester:
        row.requesterEmail === null || row.requesterLanguage === null
          ? null
          : { email: row.requesterEmail, language: row.requesterLanguage },
    };
  }

  async stalled(requestedBefore: Date): Promise<readonly string[]> {
    const rows = await this.db
      .select({ id: projectExports.id })
      .from(projectExports)
      .where(
        and(eq(projectExports.status, 'pending'), lt(projectExports.requestedAt, requestedBefore)),
      )
      .orderBy(asc(projectExports.requestedAt));
    return rows.map((row) => row.id);
  }

  async complete(exportId: string, completed: CompletedExport): Promise<void> {
    await this.db
      .update(projectExports)
      .set({
        status: 'done',
        finishedAt: completed.at,
        objectKey: completed.objectKey,
        eventCount: completed.eventCount,
      })
      .where(eq(projectExports.id, exportId));
  }

  async fail(exportId: string, at: Date): Promise<void> {
    await this.db
      .update(projectExports)
      .set({ status: 'failed', finishedAt: at })
      .where(eq(projectExports.id, exportId));
  }

  page(
    projectId: string,
    after: ExportCursor | null,
    limit: number,
  ): Promise<readonly ExportedEvent[]> {
    return this.db
      .select({
        id: events.id,
        occurredAt: events.occurredAt,
        name: events.name,
        path: events.path,
        sessionId: events.sessionId,
        userId: events.userId,
        referrerHost: events.referrerHost,
        utmSource: events.utmSource,
        utmMedium: events.utmMedium,
        utmCampaign: events.utmCampaign,
        fromAdClick: events.fromAdClick,
        channel: events.channel,
        deviceType: events.deviceType,
        browser: events.browser,
        os: events.os,
        country: events.country,
        region: events.region,
        regionName: events.regionName,
        properties: events.properties,
      })
      .from(events)
      .where(
        and(
          eq(events.projectId, projectId),
          after === null
            ? undefined
            : sql`(${events.occurredAt}, ${events.id}) > (${after.occurredAt.toISOString()}::timestamptz, ${after.id}::uuid)`,
        ),
      )
      .orderBy(asc(events.occurredAt), asc(events.id))
      .limit(limit);
  }
}

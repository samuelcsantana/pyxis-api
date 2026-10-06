import { sql } from 'drizzle-orm';
import type {
  ExpiredSessionCutoffs,
  RetentionRepository,
} from '../../domain/retention/retention.repository';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { adminSessions, otpCodes } from '../database/schema/admins';
import { events } from '../database/schema/events';
import { projects } from '../database/schema/projects';

export class DrizzleRetentionRepository implements RetentionRepository {
  constructor(private readonly db: DrizzleDatabase) {}

  async projectIds(): Promise<readonly string[]> {
    const rows = await this.db.select({ id: projects.id }).from(projects);
    return rows.map((row) => row.id);
  }

  async deleteEventsBefore(projectId: string, cutoff: Date, limit: number): Promise<number> {
    const deleted = await this.db.execute<{ id: string }>(sql`
      DELETE FROM ${events}
      WHERE ctid IN (
        SELECT ctid FROM ${events}
        WHERE ${events.projectId} = ${projectId} AND ${events.occurredAt} < ${cutoff.toISOString()}::timestamptz
        LIMIT ${limit}
      )
      RETURNING ${events.id}`);
    return deleted.length;
  }

  async deleteExpiredSessions(cutoffs: ExpiredSessionCutoffs): Promise<number> {
    const deleted = await this.db.execute<{ id: string }>(sql`
      DELETE FROM ${adminSessions}
      WHERE ${adminSessions.revokedAt} IS NOT NULL
        OR ${adminSessions.createdAt} < ${cutoffs.createdBefore.toISOString()}::timestamptz
        OR ${adminSessions.lastUsedAt} < ${cutoffs.lastUsedBefore.toISOString()}::timestamptz
      RETURNING ${adminSessions.id}`);
    return deleted.length;
  }

  async deleteExpiredSignInCodes(now: Date): Promise<number> {
    const deleted = await this.db.execute<{ id: string }>(sql`
      DELETE FROM ${otpCodes}
      WHERE ${otpCodes.expiresAt} < ${now.toISOString()}::timestamptz
      RETURNING ${otpCodes.id}`);
    return deleted.length;
  }
}

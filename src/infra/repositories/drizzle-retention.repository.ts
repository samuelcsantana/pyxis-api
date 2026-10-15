import { and, eq, isNull, sql } from 'drizzle-orm';
import type {
  ExpiredSessionCutoffs,
  RetentionRepository,
  SpentConnectionTokenCutoffs,
} from '../../domain/retention/retention.repository';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { accounts, trialCards } from '../database/schema/accounts';
import { adminSessions, otpCodes } from '../database/schema/admins';
import { events } from '../database/schema/events';
import {
  oauthAuthorizationRequests,
  oauthConnectionTokens,
  oauthConnections,
} from '../database/schema/oauth';
import { projects } from '../database/schema/projects';

export class DrizzleRetentionRepository implements RetentionRepository {
  constructor(private readonly db: DrizzleDatabase) {}

  async projectIdsNotHeld(): Promise<readonly string[]> {
    const rows = await this.db
      .select({ id: projects.id })
      .from(projects)
      .leftJoin(accounts, eq(accounts.id, projects.accountId))
      .where(and(isNull(projects.deletionHeldAt), isNull(accounts.deletionHeldAt)));
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

  async deleteTrialCardsStartedBefore(cutoff: Date): Promise<number> {
    const deleted = await this.db.execute<{ fingerprint: string }>(sql`
      DELETE FROM ${trialCards}
      WHERE ${trialCards.trialStartedAt} < ${cutoff.toISOString()}::timestamptz
      RETURNING ${trialCards.fingerprint}`);
    return deleted.length;
  }

  async deleteEndedConnections(idleCutoff: Date): Promise<number> {
    const deleted = await this.db.execute<{ id: string }>(sql`
      DELETE FROM ${oauthConnections}
      WHERE ${oauthConnections.revokedAt} IS NOT NULL
        OR ${oauthConnections.lastUsedAt} <= ${idleCutoff.toISOString()}::timestamptz
      RETURNING ${oauthConnections.id}`);
    return deleted.length;
  }

  async deleteSpentConnectionTokens(cutoffs: SpentConnectionTokenCutoffs): Promise<number> {
    const deleted = await this.db.execute<{ id: string }>(sql`
      DELETE FROM ${oauthConnectionTokens}
      WHERE ${oauthConnectionTokens.expiresAt} <= ${cutoffs.expiredBefore.toISOString()}::timestamptz
        OR ${oauthConnectionTokens.rotatedAt} < ${cutoffs.rotatedBefore.toISOString()}::timestamptz
      RETURNING ${oauthConnectionTokens.id}`);
    return deleted.length;
  }

  async deleteFinishedAuthorizationRequests(expiredBefore: Date): Promise<number> {
    const deleted = await this.db.execute<{ id: string }>(sql`
      DELETE FROM ${oauthAuthorizationRequests}
      WHERE ${oauthAuthorizationRequests.expiresAt} < ${expiredBefore.toISOString()}::timestamptz
      RETURNING ${oauthAuthorizationRequests.id}`);
    return deleted.length;
  }
}

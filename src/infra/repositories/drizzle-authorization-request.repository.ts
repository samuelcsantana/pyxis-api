import { Inject, Injectable } from '@nestjs/common';
import { and, eq, getTableColumns, gt, isNotNull, isNull, sql } from 'drizzle-orm';
import type {
  AuthorizationRequest,
  RedeemedAuthorizationCode,
} from '../../domain/entities/authorization-request.entity';
import type {
  AuthorizationApproval,
  AuthorizationRequestRepository,
  NewAuthorizationRequest,
  SpentAuthorizationCode,
} from '../../domain/repositories/authorization-request.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { insertedRow } from '../database/inserted-row';
import { oauthAuthorizationRequests } from '../database/schema/oauth';

type AuthorizationRequestRow = typeof oauthAuthorizationRequests.$inferSelect;

function toAuthorizationRequest(row: AuthorizationRequestRow): AuthorizationRequest {
  return {
    id: row.id,
    clientId: row.clientId,
    redirectUri: row.redirectUri,
    state: row.state,
    codeChallenge: row.codeChallenge,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

function pending(requestId: string, now: Date) {
  return and(
    eq(oauthAuthorizationRequests.id, requestId),
    isNull(oauthAuthorizationRequests.decision),
    gt(oauthAuthorizationRequests.expiresAt, now),
  );
}

@Injectable()
export class DrizzleAuthorizationRequestRepository implements AuthorizationRequestRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async create(request: NewAuthorizationRequest): Promise<AuthorizationRequest> {
    const row = insertedRow(
      await this.db.insert(oauthAuthorizationRequests).values(request).returning(),
    );
    return toAuthorizationRequest(row);
  }

  async findPending(requestId: string, now: Date): Promise<AuthorizationRequest | null> {
    const [row] = await this.db
      .select()
      .from(oauthAuthorizationRequests)
      .where(pending(requestId, now))
      .limit(1);
    return row === undefined ? null : toAuthorizationRequest(row);
  }

  async approve(
    requestId: string,
    approval: AuthorizationApproval,
  ): Promise<AuthorizationRequest | null> {
    const [row] = await this.db
      .update(oauthAuthorizationRequests)
      .set({
        decision: 'approved',
        decidedAt: approval.decidedAt,
        adminUserId: approval.adminUserId,
        codeHash: approval.codeHash,
        codeExpiresAt: approval.codeExpiresAt,
      })
      .where(pending(requestId, approval.decidedAt))
      .returning();
    return row === undefined ? null : toAuthorizationRequest(row);
  }

  async deny(requestId: string, decidedAt: Date): Promise<AuthorizationRequest | null> {
    const [row] = await this.db
      .update(oauthAuthorizationRequests)
      .set({ decision: 'denied', decidedAt })
      .where(pending(requestId, decidedAt))
      .returning();
    return row === undefined ? null : toAuthorizationRequest(row);
  }

  async redeemCode(codeHash: string, now: Date): Promise<RedeemedAuthorizationCode | null> {
    const [row] = await this.db
      .update(oauthAuthorizationRequests)
      .set({ codeUsedAt: now })
      .where(
        and(
          eq(oauthAuthorizationRequests.codeHash, codeHash),
          isNull(oauthAuthorizationRequests.codeUsedAt),
          gt(oauthAuthorizationRequests.codeExpiresAt, now),
          isNotNull(oauthAuthorizationRequests.adminUserId),
        ),
      )
      .returning({
        ...getTableColumns(oauthAuthorizationRequests),
        approvedBy: sql<string>`${oauthAuthorizationRequests.adminUserId}`,
      });
    return row === undefined
      ? null
      : { request: toAuthorizationRequest(row), adminUserId: row.approvedBy };
  }

  async findSpentCode(codeHash: string): Promise<SpentAuthorizationCode | null> {
    const [row] = await this.db
      .select({ connectionId: oauthAuthorizationRequests.connectionId })
      .from(oauthAuthorizationRequests)
      .where(
        and(
          eq(oauthAuthorizationRequests.codeHash, codeHash),
          isNotNull(oauthAuthorizationRequests.codeUsedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async linkConnection(requestId: string, connectionId: string): Promise<void> {
    await this.db
      .update(oauthAuthorizationRequests)
      .set({ connectionId })
      .where(eq(oauthAuthorizationRequests.id, requestId));
  }
}

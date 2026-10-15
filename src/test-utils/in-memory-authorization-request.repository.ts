import type {
  AuthorizationRequest,
  RedeemedAuthorizationCode,
} from '../domain/entities/authorization-request.entity';
import type {
  AuthorizationApproval,
  AuthorizationRequestRepository,
  NewAuthorizationRequest,
  SpentAuthorizationCode,
} from '../domain/repositories/authorization-request.repository';

interface StoredAuthorizationRequest {
  readonly request: AuthorizationRequest;
  decision: 'approved' | 'denied' | null;
  approval: AuthorizationApproval | null;
  codeUsedAt: Date | null;
  connectionId: string | null;
}

export class InMemoryAuthorizationRequestRepository implements AuthorizationRequestRepository {
  readonly stored: StoredAuthorizationRequest[] = [];

  create(input: NewAuthorizationRequest): Promise<AuthorizationRequest> {
    const request: AuthorizationRequest = {
      id: `00000000-0000-4000-b000-${String(this.stored.length + 1).padStart(12, '0')}`,
      ...input,
    };
    this.stored.push({
      request,
      decision: null,
      approval: null,
      codeUsedAt: null,
      connectionId: null,
    });
    return Promise.resolve(request);
  }

  findPending(requestId: string, now: Date): Promise<AuthorizationRequest | null> {
    return Promise.resolve(this.pending(requestId, now)?.request ?? null);
  }

  approve(
    requestId: string,
    approval: AuthorizationApproval,
  ): Promise<AuthorizationRequest | null> {
    const entry = this.pending(requestId, approval.decidedAt);
    if (entry === undefined) {
      return Promise.resolve(null);
    }
    entry.decision = 'approved';
    entry.approval = approval;
    return Promise.resolve(entry.request);
  }

  deny(requestId: string, decidedAt: Date): Promise<AuthorizationRequest | null> {
    const entry = this.pending(requestId, decidedAt);
    if (entry === undefined) {
      return Promise.resolve(null);
    }
    entry.decision = 'denied';
    return Promise.resolve(entry.request);
  }

  redeemCode(codeHash: string, now: Date): Promise<RedeemedAuthorizationCode | null> {
    const entry = this.stored.find(
      (candidate) =>
        candidate.approval?.codeHash === codeHash &&
        candidate.codeUsedAt === null &&
        now.getTime() < candidate.approval.codeExpiresAt.getTime(),
    );
    if (entry?.approval === undefined || entry.approval === null) {
      return Promise.resolve(null);
    }
    entry.codeUsedAt = now;
    return Promise.resolve({ request: entry.request, adminUserId: entry.approval.adminUserId });
  }

  findSpentCode(codeHash: string): Promise<SpentAuthorizationCode | null> {
    const entry = this.stored.find(
      (candidate) => candidate.approval?.codeHash === codeHash && candidate.codeUsedAt !== null,
    );
    return Promise.resolve(entry === undefined ? null : { connectionId: entry.connectionId });
  }

  linkConnection(requestId: string, connectionId: string): Promise<void> {
    for (const entry of this.stored) {
      if (entry.request.id === requestId) {
        entry.connectionId = connectionId;
      }
    }
    return Promise.resolve();
  }

  private pending(requestId: string, now: Date): StoredAuthorizationRequest | undefined {
    return this.stored.find(
      (candidate) =>
        candidate.request.id === requestId &&
        candidate.decision === null &&
        now.getTime() < candidate.request.expiresAt.getTime(),
    );
  }
}

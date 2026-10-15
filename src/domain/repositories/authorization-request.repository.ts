import type {
  AuthorizationRequest,
  RedeemedAuthorizationCode,
} from '../entities/authorization-request.entity';

export interface NewAuthorizationRequest {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly state: string | null;
  readonly codeChallenge: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface AuthorizationApproval {
  readonly adminUserId: string;
  readonly codeHash: string;
  readonly codeExpiresAt: Date;
  readonly decidedAt: Date;
}

export interface SpentAuthorizationCode {
  readonly connectionId: string | null;
}

export interface AuthorizationRequestRepository {
  create(request: NewAuthorizationRequest): Promise<AuthorizationRequest>;
  findPending(requestId: string, now: Date): Promise<AuthorizationRequest | null>;
  approve(requestId: string, approval: AuthorizationApproval): Promise<AuthorizationRequest | null>;
  deny(requestId: string, decidedAt: Date): Promise<AuthorizationRequest | null>;
  redeemCode(codeHash: string, now: Date): Promise<RedeemedAuthorizationCode | null>;
  findSpentCode(codeHash: string): Promise<SpentAuthorizationCode | null>;
  linkConnection(requestId: string, connectionId: string): Promise<void>;
}

export const AUTHORIZATION_REQUEST_REPOSITORY = Symbol('AuthorizationRequestRepository');

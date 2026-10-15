export interface AuthorizationRequest {
  readonly id: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly state: string | null;
  readonly codeChallenge: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface RedeemedAuthorizationCode {
  readonly request: AuthorizationRequest;
  readonly adminUserId: string;
}

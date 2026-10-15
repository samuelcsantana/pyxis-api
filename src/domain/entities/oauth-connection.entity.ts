export interface OAuthConnection {
  readonly id: string;
  readonly adminUserId: string;
  readonly clientId: string;
  readonly createdAt: Date;
  readonly lastUsedAt: Date;
}

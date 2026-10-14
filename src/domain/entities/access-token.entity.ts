export interface AccessToken {
  readonly id: string;
  readonly adminUserId: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
  readonly expiresAt: Date;
}

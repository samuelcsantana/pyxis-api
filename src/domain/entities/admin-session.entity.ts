export interface AdminSession {
  readonly id: string;
  readonly adminUserId: string;
  readonly createdAt: Date;
  readonly lastUsedAt: Date;
}

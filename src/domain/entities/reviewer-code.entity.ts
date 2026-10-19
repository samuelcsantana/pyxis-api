export interface ReviewerCode {
  readonly adminUserId: string;
  readonly codeHash: string;
  readonly failedAttempts: number;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

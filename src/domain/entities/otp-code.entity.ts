export interface OtpCode {
  readonly id: string;
  readonly email: string;
  readonly codeHash: string;
  readonly expiresAt: Date;
}

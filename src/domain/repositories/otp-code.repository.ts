import type { OtpCode } from '../entities/otp-code.entity';

export interface NewOtpCode {
  readonly email: string;
  readonly codeHash: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface OtpCodeRepository {
  create(code: NewOtpCode): Promise<OtpCode>;
  countCreatedSince(email: string, since: Date): Promise<number>;
  findLatestValid(email: string, now: Date): Promise<OtpCode | null>;
  consumeAttempt(codeId: string, maxAttempts: number): Promise<boolean>;
  claim(codeId: string, usedAt: Date): Promise<boolean>;
}

export const OTP_CODE_REPOSITORY = Symbol('OtpCodeRepository');

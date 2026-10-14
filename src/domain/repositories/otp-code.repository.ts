import type { CodePurpose } from '../auth/code-purpose';
import type { EmailLanguage } from '../auth/email-language';
import type { OtpCode } from '../entities/otp-code.entity';

export interface NewOtpCode {
  readonly email: string;
  readonly codeHash: string;
  readonly emailLanguage: EmailLanguage;
  readonly purpose: CodePurpose;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface OtpCodeRepository {
  create(code: NewOtpCode): Promise<OtpCode>;
  countCreatedSince(email: string, since: Date): Promise<number>;
  countPurposeSince(purpose: CodePurpose, since: Date): Promise<number>;
  findLatestValid(email: string, now: Date, purpose: CodePurpose): Promise<OtpCode | null>;
  consumeAttempt(codeId: string, maxAttempts: number): Promise<boolean>;
  claim(codeId: string, usedAt: Date): Promise<boolean>;
}

export const OTP_CODE_REPOSITORY = Symbol('OtpCodeRepository');

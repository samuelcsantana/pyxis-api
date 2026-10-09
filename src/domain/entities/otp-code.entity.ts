import type { EmailLanguage } from '../auth/email-language';

export interface OtpCode {
  readonly id: string;
  readonly email: string;
  readonly codeHash: string;
  readonly emailLanguage: EmailLanguage;
  readonly expiresAt: Date;
}

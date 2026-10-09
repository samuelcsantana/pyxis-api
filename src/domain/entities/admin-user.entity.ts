import type { EmailLanguage } from '../auth/email-language';

export interface AdminUser {
  readonly id: string;
  readonly email: string;
  readonly emailLanguage: EmailLanguage;
  readonly createdAt: Date;
}

import type { EmailLanguage } from '../auth/email-language';
import type { WeeklyDigest } from '../digest/weekly-digest';

export interface MailSender {
  sendSignInCode(email: string, code: string, language: EmailLanguage): Promise<void>;
  sendWeeklyDigest(email: string, digest: WeeklyDigest, language: EmailLanguage): Promise<void>;
}

export const MAIL_SENDER = Symbol('MailSender');

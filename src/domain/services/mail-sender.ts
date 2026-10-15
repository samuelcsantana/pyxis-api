import type { QuotaNotice } from '../accounts/quota-notice';
import type { EmailLanguage } from '../auth/email-language';
import type { WeeklyDigest } from '../digest/weekly-digest';
import type { Invitation } from '../people/invitation';

export interface MailSender {
  sendSignInCode(email: string, code: string, language: EmailLanguage): Promise<void>;
  sendSignUpCode(email: string, code: string, language: EmailLanguage): Promise<void>;
  sendWeeklyDigest(email: string, digest: WeeklyDigest, language: EmailLanguage): Promise<void>;
  sendQuotaNotice(email: string, notice: QuotaNotice, language: EmailLanguage): Promise<void>;
  sendInvitation(email: string, invitation: Invitation, language: EmailLanguage): Promise<void>;
}

export const MAIL_SENDER = Symbol('MailSender');

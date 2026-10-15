import type { AccountNotice } from '../accounts/account-notice';
import type { QuotaNotice } from '../accounts/quota-notice';
import type { Welcome } from '../accounts/welcome';
import type { EmailLanguage } from '../auth/email-language';
import type { WeeklyDigest } from '../digest/weekly-digest';
import type { ExportReady } from '../exports/export-ready';
import type { NoticeText } from '../notices/operator-notice';
import type { Invitation } from '../people/invitation';

export interface MailSender {
  sendSignInCode(email: string, code: string, language: EmailLanguage): Promise<void>;
  sendSignUpCode(email: string, code: string, language: EmailLanguage): Promise<void>;
  sendWeeklyDigest(email: string, digest: WeeklyDigest, language: EmailLanguage): Promise<void>;
  sendQuotaNotice(email: string, notice: QuotaNotice, language: EmailLanguage): Promise<void>;
  sendInvitation(email: string, invitation: Invitation, language: EmailLanguage): Promise<void>;
  sendAccountNotice(email: string, notice: AccountNotice, language: EmailLanguage): Promise<void>;
  sendWelcome(email: string, welcome: Welcome, language: EmailLanguage): Promise<void>;
  sendExportReady(email: string, ready: ExportReady, language: EmailLanguage): Promise<void>;
  sendOperatorNotice(email: string, notice: NoticeText, language: EmailLanguage): Promise<void>;
}

export const MAIL_SENDER = Symbol('MailSender');

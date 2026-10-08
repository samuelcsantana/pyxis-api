import type { EmailLanguage } from '../auth/email-language';

export interface MailSender {
  sendSignInCode(email: string, code: string, language: EmailLanguage): Promise<void>;
}

export const MAIL_SENDER = Symbol('MailSender');

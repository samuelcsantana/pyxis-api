import type { AccountNotice } from '../../domain/accounts/account-notice';
import type { QuotaNotice } from '../../domain/accounts/quota-notice';
import type { Welcome } from '../../domain/accounts/welcome';
import type { EmailLanguage } from '../../domain/auth/email-language';
import type { WeeklyDigest } from '../../domain/digest/weekly-digest';
import type { ExportReady } from '../../domain/exports/export-ready';
import type { Invitation } from '../../domain/people/invitation';
import type { MailSender } from '../../domain/services/mail-sender';
import { buildAccountNoticeEmail } from './account-notice-email';
import type { EmailContent, EmailLinks } from './email-layout';
import { buildExportReadyEmail } from './export-ready-email';
import { buildInvitationEmail } from './invitation-email';
import { buildQuotaNoticeEmail } from './quota-notice-email';
import { buildSignInCodeEmail, buildSignUpCodeEmail } from './sign-in-code-email';
import { buildWeeklyDigestEmail } from './weekly-digest-email';
import { buildWelcomeEmail } from './welcome-email';

export const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
export const RESEND_TIMEOUT_MS = 10_000;

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export class ResendMailSender implements MailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly links: EmailLinks,
    private readonly send: FetchLike = fetch,
    private readonly supportEmail: string | null = null,
  ) {}

  sendSignInCode(email: string, code: string, language: EmailLanguage): Promise<void> {
    return this.deliver(email, buildSignInCodeEmail(code, language, this.links));
  }

  sendSignUpCode(email: string, code: string, language: EmailLanguage): Promise<void> {
    return this.deliver(email, buildSignUpCodeEmail(code, language, this.links));
  }

  sendWeeklyDigest(email: string, digest: WeeklyDigest, language: EmailLanguage): Promise<void> {
    return this.deliver(email, buildWeeklyDigestEmail(digest, language, this.links));
  }

  sendQuotaNotice(email: string, notice: QuotaNotice, language: EmailLanguage): Promise<void> {
    return this.deliver(
      email,
      buildQuotaNoticeEmail(notice, language, this.links, this.supportEmail),
      this.supportEmail,
    );
  }

  sendInvitation(email: string, invitation: Invitation, language: EmailLanguage): Promise<void> {
    return this.deliver(
      email,
      buildInvitationEmail(invitation, language, this.links),
      invitation.inviterEmail,
    );
  }

  sendAccountNotice(email: string, notice: AccountNotice, language: EmailLanguage): Promise<void> {
    return this.deliver(
      email,
      buildAccountNoticeEmail(notice, language, this.links, this.supportEmail),
      this.supportEmail,
    );
  }

  sendWelcome(email: string, welcome: Welcome, language: EmailLanguage): Promise<void> {
    return this.deliver(email, buildWelcomeEmail(welcome, language, this.links), this.supportEmail);
  }

  sendExportReady(email: string, ready: ExportReady, language: EmailLanguage): Promise<void> {
    return this.deliver(
      email,
      buildExportReadyEmail(ready, language, this.links),
      this.supportEmail,
    );
  }

  private async deliver(
    email: string,
    content: EmailContent,
    replyTo: string | null = null,
  ): Promise<void> {
    const response = await this.send(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: email,
        ...(replyTo === null ? {} : { reply_to: replyTo }),
        ...content,
      }),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Resend answered ${String(response.status)}`);
    }
  }
}

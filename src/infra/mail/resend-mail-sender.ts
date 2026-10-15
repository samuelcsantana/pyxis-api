import type { QuotaNotice } from '../../domain/accounts/quota-notice';
import type { EmailLanguage } from '../../domain/auth/email-language';
import type { WeeklyDigest } from '../../domain/digest/weekly-digest';
import type { Invitation } from '../../domain/people/invitation';
import type { MailSender } from '../../domain/services/mail-sender';
import type { EmailContent, EmailLinks } from './email-layout';
import { buildInvitationEmail } from './invitation-email';
import { buildQuotaNoticeEmail } from './quota-notice-email';
import { buildSignInCodeEmail, buildSignUpCodeEmail } from './sign-in-code-email';
import { buildWeeklyDigestEmail } from './weekly-digest-email';

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

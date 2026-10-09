import type { EmailLanguage } from '../../domain/auth/email-language';
import type { WeeklyDigest } from '../../domain/digest/weekly-digest';
import type { MailSender } from '../../domain/services/mail-sender';
import type { EmailContent } from './email-layout';
import { buildSignInCodeEmail } from './sign-in-code-email';
import { buildWeeklyDigestEmail } from './weekly-digest-email';

export const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
export const RESEND_TIMEOUT_MS = 10_000;

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export class ResendMailSender implements MailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly send: FetchLike = fetch,
  ) {}

  sendSignInCode(email: string, code: string, language: EmailLanguage): Promise<void> {
    return this.deliver(email, buildSignInCodeEmail(code, language));
  }

  sendWeeklyDigest(email: string, digest: WeeklyDigest, language: EmailLanguage): Promise<void> {
    return this.deliver(email, buildWeeklyDigestEmail(digest, language));
  }

  private async deliver(email: string, content: EmailContent): Promise<void> {
    const response = await this.send(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, to: email, ...content }),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Resend answered ${String(response.status)}`);
    }
  }
}

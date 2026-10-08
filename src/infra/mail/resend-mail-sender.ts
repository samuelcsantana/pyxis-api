import type { EmailLanguage } from '../../domain/auth/email-language';
import type { MailSender } from '../../domain/services/mail-sender';
import { buildSignInCodeEmail } from './sign-in-code-email';

export const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
export const RESEND_TIMEOUT_MS = 10_000;

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export class ResendMailSender implements MailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly send: FetchLike = fetch,
  ) {}

  async sendSignInCode(email: string, code: string, language: EmailLanguage): Promise<void> {
    const response = await this.send(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, to: email, ...buildSignInCodeEmail(code, language) }),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Resend answered ${String(response.status)}`);
    }
  }
}

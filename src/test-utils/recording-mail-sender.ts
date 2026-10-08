import type { EmailLanguage } from '../domain/auth/email-language';
import type { MailSender } from '../domain/services/mail-sender';

export interface SentSignInCode {
  readonly email: string;
  readonly code: string;
  readonly language: EmailLanguage;
}

export class RecordingMailSender implements MailSender {
  readonly sent: SentSignInCode[] = [];
  private failure: Error | null = null;

  failWith(error: Error): void {
    this.failure = error;
  }

  sendSignInCode(email: string, code: string, language: EmailLanguage): Promise<void> {
    if (this.failure !== null) {
      return Promise.reject(this.failure);
    }
    this.sent.push({ email, code, language });
    return Promise.resolve();
  }
}

import type { MailSender } from '../domain/services/mail-sender';

export class RecordingMailSender implements MailSender {
  readonly sent: { readonly email: string; readonly code: string }[] = [];
  private failure: Error | null = null;

  failWith(error: Error): void {
    this.failure = error;
  }

  sendSignInCode(email: string, code: string): Promise<void> {
    if (this.failure !== null) {
      return Promise.reject(this.failure);
    }
    this.sent.push({ email, code });
    return Promise.resolve();
  }
}

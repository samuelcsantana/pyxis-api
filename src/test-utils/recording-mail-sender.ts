import type { EmailLanguage } from '../domain/auth/email-language';
import type { WeeklyDigest } from '../domain/digest/weekly-digest';
import type { MailSender } from '../domain/services/mail-sender';

export interface SentSignInCode {
  readonly email: string;
  readonly code: string;
  readonly language: EmailLanguage;
}

export interface SentWeeklyDigest {
  readonly email: string;
  readonly digest: WeeklyDigest;
  readonly language: EmailLanguage;
}

export class RecordingMailSender implements MailSender {
  readonly sent: SentSignInCode[] = [];
  readonly digests: SentWeeklyDigest[] = [];
  private failure: Error | null = null;
  private readonly failingAddresses = new Map<string, Error>();

  failWith(error: Error): void {
    this.failure = error;
  }

  failFor(email: string, error: Error): void {
    this.failingAddresses.set(email, error);
  }

  sendSignInCode(email: string, code: string, language: EmailLanguage): Promise<void> {
    if (this.failure !== null) {
      return Promise.reject(this.failure);
    }
    this.sent.push({ email, code, language });
    return Promise.resolve();
  }

  sendWeeklyDigest(email: string, digest: WeeklyDigest, language: EmailLanguage): Promise<void> {
    const failure = this.failingAddresses.get(email);
    if (failure !== undefined) {
      return Promise.reject(failure);
    }
    this.digests.push({ email, digest, language });
    return Promise.resolve();
  }
}

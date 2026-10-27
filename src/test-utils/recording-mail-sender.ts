import type { AccountNotice } from '../domain/accounts/account-notice';
import type { QuotaNotice } from '../domain/accounts/quota-notice';
import type { SubscriptionConfirmation } from '../domain/accounts/subscription-confirmation';
import type { Welcome } from '../domain/accounts/welcome';
import type { EmailLanguage } from '../domain/auth/email-language';
import type { WeeklyDigest } from '../domain/digest/weekly-digest';
import type { ExportReady } from '../domain/exports/export-ready';
import type { NoticeText } from '../domain/notices/operator-notice';
import type { Invitation } from '../domain/people/invitation';
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

export interface SentQuotaNotice {
  readonly email: string;
  readonly notice: QuotaNotice;
  readonly language: EmailLanguage;
}

export interface SentInvitation {
  readonly email: string;
  readonly invitation: Invitation;
  readonly language: EmailLanguage;
}

export interface SentAccountNotice {
  readonly email: string;
  readonly notice: AccountNotice;
  readonly language: EmailLanguage;
}

export interface SentWelcome {
  readonly email: string;
  readonly welcome: Welcome;
  readonly language: EmailLanguage;
}

export interface SentSubscriptionConfirmation {
  readonly email: string;
  readonly confirmation: SubscriptionConfirmation;
  readonly language: EmailLanguage;
}

export interface SentExportReady {
  readonly email: string;
  readonly ready: ExportReady;
  readonly language: EmailLanguage;
}

export interface SentOperatorNotice {
  readonly email: string;
  readonly notice: NoticeText;
  readonly language: EmailLanguage;
}

export class RecordingMailSender implements MailSender {
  readonly sent: SentSignInCode[] = [];
  readonly signUpCodes: SentSignInCode[] = [];
  readonly quotaNotices: SentQuotaNotice[] = [];
  readonly digests: SentWeeklyDigest[] = [];
  readonly invitations: SentInvitation[] = [];
  readonly accountNotices: SentAccountNotice[] = [];
  readonly welcomes: SentWelcome[] = [];
  readonly subscriptionConfirmations: SentSubscriptionConfirmation[] = [];
  readonly exportsReady: SentExportReady[] = [];
  readonly operatorNotices: SentOperatorNotice[] = [];
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

  sendSignUpCode(email: string, code: string, language: EmailLanguage): Promise<void> {
    if (this.failure !== null) {
      return Promise.reject(this.failure);
    }
    this.signUpCodes.push({ email, code, language });
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

  sendQuotaNotice(email: string, notice: QuotaNotice, language: EmailLanguage): Promise<void> {
    const failure = this.failingAddresses.get(email);
    if (failure !== undefined) {
      return Promise.reject(failure);
    }
    this.quotaNotices.push({ email, notice, language });
    return Promise.resolve();
  }

  sendInvitation(email: string, invitation: Invitation, language: EmailLanguage): Promise<void> {
    const failure = this.failingAddresses.get(email);
    if (failure !== undefined) {
      return Promise.reject(failure);
    }
    this.invitations.push({ email, invitation, language });
    return Promise.resolve();
  }

  sendAccountNotice(email: string, notice: AccountNotice, language: EmailLanguage): Promise<void> {
    const failure = this.failingAddresses.get(email);
    if (failure !== undefined) {
      return Promise.reject(failure);
    }
    this.accountNotices.push({ email, notice, language });
    return Promise.resolve();
  }

  sendWelcome(email: string, welcome: Welcome, language: EmailLanguage): Promise<void> {
    const failure = this.failingAddresses.get(email);
    if (failure !== undefined) {
      return Promise.reject(failure);
    }
    this.welcomes.push({ email, welcome, language });
    return Promise.resolve();
  }

  sendSubscriptionConfirmed(
    email: string,
    confirmation: SubscriptionConfirmation,
    language: EmailLanguage,
  ): Promise<void> {
    const failure = this.failingAddresses.get(email);
    if (failure !== undefined) {
      return Promise.reject(failure);
    }
    this.subscriptionConfirmations.push({ email, confirmation, language });
    return Promise.resolve();
  }

  sendExportReady(email: string, ready: ExportReady, language: EmailLanguage): Promise<void> {
    const failure = this.failingAddresses.get(email);
    if (failure !== undefined) {
      return Promise.reject(failure);
    }
    this.exportsReady.push({ email, ready, language });
    return Promise.resolve();
  }

  sendOperatorNotice(email: string, notice: NoticeText, language: EmailLanguage): Promise<void> {
    const failure = this.failingAddresses.get(email);
    if (failure !== undefined) {
      return Promise.reject(failure);
    }
    this.operatorNotices.push({ email, notice, language });
    return Promise.resolve();
  }
}

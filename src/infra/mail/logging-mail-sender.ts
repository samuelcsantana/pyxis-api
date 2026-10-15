import type { NoticeText } from '../../domain/notices/operator-notice';
import { Logger } from '@nestjs/common';
import type { AccountNotice } from '../../domain/accounts/account-notice';
import type { QuotaNotice } from '../../domain/accounts/quota-notice';
import type { Welcome } from '../../domain/accounts/welcome';
import type { EmailLanguage } from '../../domain/auth/email-language';
import type { WeeklyDigest } from '../../domain/digest/weekly-digest';
import type { ExportReady } from '../../domain/exports/export-ready';
import type { Invitation } from '../../domain/people/invitation';
import type { MailSender } from '../../domain/services/mail-sender';
import { weeklyDigestSubject } from './weekly-digest-email';

export class LoggingMailSender implements MailSender {
  private readonly logger = new Logger('LocalMail');

  sendSignInCode(_email: string, code: string, language: EmailLanguage): Promise<void> {
    this.logger.log({ message: 'mail.sign_in_code', code, language });
    return Promise.resolve();
  }

  sendSignUpCode(_email: string, code: string, language: EmailLanguage): Promise<void> {
    this.logger.log({ message: 'mail.sign_up_code', code, language });
    return Promise.resolve();
  }

  sendWeeklyDigest(_email: string, digest: WeeklyDigest, language: EmailLanguage): Promise<void> {
    this.logger.log({
      message: 'mail.weekly_digest',
      projectId: digest.projectId,
      week: digest.week,
      language,
      subject: weeklyDigestSubject(digest, language),
    });
    return Promise.resolve();
  }

  sendQuotaNotice(_email: string, notice: QuotaNotice, language: EmailLanguage): Promise<void> {
    this.logger.log({
      message: 'mail.quota_notice',
      kind: notice.kind,
      month: notice.month,
      events: notice.events,
      language,
    });
    return Promise.resolve();
  }

  sendAccountNotice(_email: string, notice: AccountNotice, language: EmailLanguage): Promise<void> {
    this.logger.log({ message: 'mail.account_notice', kind: notice.kind, language });
    return Promise.resolve();
  }

  sendWelcome(_email: string, welcome: Welcome, language: EmailLanguage): Promise<void> {
    this.logger.log({
      message: 'mail.welcome',
      trial: welcome.trialEndsAt !== null,
      withTerms: welcome.terms !== null,
      language,
    });
    return Promise.resolve();
  }

  sendExportReady(_email: string, ready: ExportReady, language: EmailLanguage): Promise<void> {
    this.logger.log({
      message: 'mail.export_ready',
      exportId: ready.exportId,
      events: ready.eventCount,
      language,
    });
    return Promise.resolve();
  }

  sendOperatorNotice(_email: string, notice: NoticeText, language: EmailLanguage): Promise<void> {
    this.logger.log({ message: 'mail.operator_notice', subject: notice.subject, language });
    return Promise.resolve();
  }

  sendInvitation(_email: string, invitation: Invitation, language: EmailLanguage): Promise<void> {
    this.logger.log({ message: 'mail.invitation', project: invitation.projectName, language });
    return Promise.resolve();
  }
}

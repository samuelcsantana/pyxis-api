import { Logger } from '@nestjs/common';
import type { QuotaNotice } from '../../domain/accounts/quota-notice';
import type { EmailLanguage } from '../../domain/auth/email-language';
import type { WeeklyDigest } from '../../domain/digest/weekly-digest';
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

  sendInvitation(_email: string, invitation: Invitation, language: EmailLanguage): Promise<void> {
    this.logger.log({ message: 'mail.invitation', project: invitation.projectName, language });
    return Promise.resolve();
  }
}

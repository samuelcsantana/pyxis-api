import { Logger } from '@nestjs/common';
import type { EmailLanguage } from '../../domain/auth/email-language';
import type { WeeklyDigest } from '../../domain/digest/weekly-digest';
import type { MailSender } from '../../domain/services/mail-sender';
import { buildWeeklyDigestEmail } from './weekly-digest-email';

export class LoggingMailSender implements MailSender {
  private readonly logger = new Logger('LocalMail');

  sendSignInCode(_email: string, code: string, language: EmailLanguage): Promise<void> {
    this.logger.log({ message: 'mail.sign_in_code', code, language });
    return Promise.resolve();
  }

  sendWeeklyDigest(_email: string, digest: WeeklyDigest, language: EmailLanguage): Promise<void> {
    this.logger.log({
      message: 'mail.weekly_digest',
      projectId: digest.projectId,
      week: digest.week,
      language,
      subject: buildWeeklyDigestEmail(digest, language).subject,
    });
    return Promise.resolve();
  }
}

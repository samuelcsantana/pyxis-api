import { Logger } from '@nestjs/common';
import type { EmailLanguage } from '../../domain/auth/email-language';
import type { MailSender } from '../../domain/services/mail-sender';

export class LoggingMailSender implements MailSender {
  private readonly logger = new Logger('LocalMail');

  sendSignInCode(_email: string, code: string, language: EmailLanguage): Promise<void> {
    this.logger.log({ message: 'mail.sign_in_code', code, language });
    return Promise.resolve();
  }
}

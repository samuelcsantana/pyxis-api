import { Logger } from '@nestjs/common';
import type { MailSender } from '../../domain/services/mail-sender';

export class LoggingMailSender implements MailSender {
  private readonly logger = new Logger('LocalMail');

  sendSignInCode(_email: string, code: string): Promise<void> {
    this.logger.log({ message: 'mail.sign_in_code', code });
    return Promise.resolve();
  }
}

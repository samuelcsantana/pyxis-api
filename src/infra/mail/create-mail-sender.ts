import type { EnvConfig } from '../../config/env.schema';
import type { MailSender } from '../../domain/services/mail-sender';
import { LoggingMailSender } from './logging-mail-sender';
import { ResendMailSender } from './resend-mail-sender';

export function createMailSender(
  env: Pick<EnvConfig, 'NODE_ENV' | 'RESEND_API_KEY' | 'MAIL_FROM'>,
): MailSender {
  if (env.RESEND_API_KEY !== undefined) {
    return new ResendMailSender(env.RESEND_API_KEY, env.MAIL_FROM);
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('RESEND_API_KEY is required in production: codes are never logged there.');
  }
  return new LoggingMailSender();
}

import type { EnvConfig } from '../../config/env.schema';
import type { MailSender } from '../../domain/services/mail-sender';
import { emailLinksFor } from './email-layout';
import { LoggingMailSender } from './logging-mail-sender';
import { ResendMailSender } from './resend-mail-sender';
import { SesMailSender, sesSend } from './ses-mail-sender';

function requiredDashboardOrigin(origin: string | undefined): string {
  if (origin === undefined) {
    throw new Error(
      'DASHBOARD_ORIGIN is required to send e-mails: their links and logo point at the dashboard.',
    );
  }
  return origin;
}

export function createMailSender(
  env: Pick<
    EnvConfig,
    | 'NODE_ENV'
    | 'MAIL_PROVIDER'
    | 'RESEND_API_KEY'
    | 'MAIL_FROM'
    | 'DASHBOARD_ORIGIN'
    | 'SUPPORT_EMAIL'
  >,
): MailSender {
  if (env.MAIL_PROVIDER === 'ses') {
    return new SesMailSender(
      env.MAIL_FROM,
      emailLinksFor(requiredDashboardOrigin(env.DASHBOARD_ORIGIN)),
      sesSend(),
      env.SUPPORT_EMAIL ?? null,
    );
  }
  if (env.RESEND_API_KEY !== undefined) {
    return new ResendMailSender(
      env.RESEND_API_KEY,
      env.MAIL_FROM,
      emailLinksFor(requiredDashboardOrigin(env.DASHBOARD_ORIGIN)),
      fetch,
      env.SUPPORT_EMAIL ?? null,
    );
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('RESEND_API_KEY is required in production: codes are never logged there.');
  }
  return new LoggingMailSender();
}

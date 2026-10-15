import { SendEmailCommand, type SendEmailCommandInput, SESv2Client } from '@aws-sdk/client-sesv2';
import type { QuotaNotice } from '../../domain/accounts/quota-notice';
import type { EmailLanguage } from '../../domain/auth/email-language';
import type { WeeklyDigest } from '../../domain/digest/weekly-digest';
import type { Invitation } from '../../domain/people/invitation';
import type { MailSender } from '../../domain/services/mail-sender';
import type { EmailContent, EmailLinks } from './email-layout';
import { buildInvitationEmail } from './invitation-email';
import { buildQuotaNoticeEmail } from './quota-notice-email';
import { buildSignInCodeEmail, buildSignUpCodeEmail } from './sign-in-code-email';
import { buildWeeklyDigestEmail } from './weekly-digest-email';

export type SesSend = (input: SendEmailCommandInput) => Promise<unknown>;

const CHARSET = 'UTF-8';

export interface SesClient {
  send(command: SendEmailCommand): Promise<unknown>;
}

export function sesSend(client: SesClient = new SESv2Client({})): SesSend {
  return (input) => client.send(new SendEmailCommand(input));
}

export class SesMailSender implements MailSender {
  constructor(
    private readonly from: string,
    private readonly links: EmailLinks,
    private readonly send: SesSend,
    private readonly supportEmail: string | null = null,
  ) {}

  sendSignInCode(email: string, code: string, language: EmailLanguage): Promise<void> {
    return this.deliver(email, buildSignInCodeEmail(code, language, this.links));
  }

  sendSignUpCode(email: string, code: string, language: EmailLanguage): Promise<void> {
    return this.deliver(email, buildSignUpCodeEmail(code, language, this.links));
  }

  sendWeeklyDigest(email: string, digest: WeeklyDigest, language: EmailLanguage): Promise<void> {
    return this.deliver(email, buildWeeklyDigestEmail(digest, language, this.links));
  }

  sendQuotaNotice(email: string, notice: QuotaNotice, language: EmailLanguage): Promise<void> {
    return this.deliver(
      email,
      buildQuotaNoticeEmail(notice, language, this.links, this.supportEmail),
      this.supportEmail,
    );
  }

  sendInvitation(email: string, invitation: Invitation, language: EmailLanguage): Promise<void> {
    return this.deliver(
      email,
      buildInvitationEmail(invitation, language, this.links),
      invitation.inviterEmail,
    );
  }

  private async deliver(
    email: string,
    content: EmailContent,
    replyTo: string | null = null,
  ): Promise<void> {
    await this.send({
      FromEmailAddress: this.from,
      Destination: { ToAddresses: [email] },
      ...(replyTo === null ? {} : { ReplyToAddresses: [replyTo] }),
      Content: {
        Simple: {
          Subject: { Data: content.subject, Charset: CHARSET },
          Body: {
            Html: { Data: content.html, Charset: CHARSET },
            Text: { Data: content.text, Charset: CHARSET },
          },
        },
      },
    });
  }
}

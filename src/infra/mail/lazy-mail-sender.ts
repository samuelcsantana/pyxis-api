import type { QuotaNotice } from '../../domain/accounts/quota-notice';
import type { EmailLanguage } from '../../domain/auth/email-language';
import type { WeeklyDigest } from '../../domain/digest/weekly-digest';
import type { MailSender } from '../../domain/services/mail-sender';

export class LazyMailSender implements MailSender {
  private sender: MailSender | null = null;

  constructor(private readonly create: () => MailSender) {}

  async sendSignInCode(email: string, code: string, language: EmailLanguage): Promise<void> {
    await this.resolved().sendSignInCode(email, code, language);
  }

  async sendWeeklyDigest(
    email: string,
    digest: WeeklyDigest,
    language: EmailLanguage,
  ): Promise<void> {
    await this.resolved().sendWeeklyDigest(email, digest, language);
  }

  async sendQuotaNotice(
    email: string,
    notice: QuotaNotice,
    language: EmailLanguage,
  ): Promise<void> {
    await this.resolved().sendQuotaNotice(email, notice, language);
  }

  private resolved(): MailSender {
    this.sender ??= this.create();
    return this.sender;
  }
}

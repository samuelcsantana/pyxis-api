import { Inject, Injectable, Logger } from '@nestjs/common';
import { WITHDRAWAL_DAYS } from '../../domain/accounts/account-lifecycle';
import { SIGN_UP_SETTINGS, type SignUpSettings } from '../../domain/accounts/sign-up-settings';
import type { AcceptedTerms } from '../../domain/accounts/welcome';
import {
  SUBSCRIPTION_CONFIRMATION_REPOSITORY,
  type SubscriptionConfirmationRepository,
  type SubscriptionConfirmationTarget,
} from '../../domain/repositories/subscription-confirmation.repository';
import { MAIL_SENDER, type MailSender } from '../../domain/services/mail-sender';

@Injectable()
export class ConfirmSubscriptionsUseCase {
  private readonly logger = new Logger(ConfirmSubscriptionsUseCase.name);

  constructor(
    @Inject(SUBSCRIPTION_CONFIRMATION_REPOSITORY)
    private readonly confirmations: SubscriptionConfirmationRepository,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
    @Inject(SIGN_UP_SETTINGS) private readonly settings: SignUpSettings,
  ) {}

  async tryConfirm(accountId: string): Promise<boolean> {
    try {
      const target = await this.confirmations.toConfirm(accountId);
      return target === null ? false : await this.confirm(target);
    } catch (error) {
      this.logger.error({
        message: 'billing.subscription_confirmation_failed',
        accountId,
        reason: String(error),
      });
      return false;
    }
  }

  async confirmPending(): Promise<number> {
    let confirmed = 0;
    for (const target of await this.confirmations.pendingConfirmations()) {
      if (await this.tryConfirm(target.accountId)) {
        confirmed += 1;
      }
    }
    return confirmed;
  }

  private async confirm(target: SubscriptionConfirmationTarget): Promise<boolean> {
    await this.mail.sendSubscriptionConfirmed(
      target.ownerEmail,
      {
        interval: target.billingInterval,
        withdrawalDays: WITHDRAWAL_DAYS,
        terms: this.termsOf(target),
      },
      target.ownerLanguage,
    );
    await this.confirmations.markConfirmed(target.accountId);
    this.logger.log({ message: 'billing.subscription_confirmed', accountId: target.accountId });
    return true;
  }

  private termsOf(target: SubscriptionConfirmationTarget): AcceptedTerms | null {
    const url = this.settings.termsUrl;
    return target.termsVersion === null || url === null
      ? null
      : { version: target.termsVersion, url };
  }
}

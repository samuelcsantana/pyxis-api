import { Inject, Injectable, Logger } from '@nestjs/common';
import { SIGN_UP_SETTINGS, type SignUpSettings } from '../../domain/accounts/sign-up-settings';
import type { AcceptedTerms } from '../../domain/accounts/welcome';
import {
  ACCOUNT_WELCOME_REPOSITORY,
  type AccountWelcomeRepository,
  type WelcomeTarget,
} from '../../domain/repositories/account-welcome.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { MAIL_SENDER, type MailSender } from '../../domain/services/mail-sender';

@Injectable()
export class WelcomeAccountsUseCase {
  private readonly logger = new Logger(WelcomeAccountsUseCase.name);

  constructor(
    @Inject(ACCOUNT_WELCOME_REPOSITORY) private readonly welcomes: AccountWelcomeRepository,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SIGN_UP_SETTINGS) private readonly settings: SignUpSettings,
  ) {}

  async tryWelcome(accountId: string): Promise<boolean> {
    try {
      const target = await this.welcomes.toWelcome(accountId);
      return target === null ? false : await this.welcome(target);
    } catch (error) {
      this.logger.error({ message: 'accounts.welcome_failed', accountId, reason: String(error) });
      return false;
    }
  }

  async welcomePending(): Promise<number> {
    let welcomed = 0;
    for (const target of await this.welcomes.pendingWelcomes()) {
      if (await this.tryWelcome(target.accountId)) {
        welcomed += 1;
      }
    }
    return welcomed;
  }

  private async welcome(target: WelcomeTarget): Promise<boolean> {
    await this.mail.sendWelcome(
      target.ownerEmail,
      {
        trialEndsAt: target.status === 'trialing' ? target.trialEndsAt : null,
        terms: this.termsOf(target),
      },
      target.ownerLanguage,
    );
    await this.welcomes.markWelcomed(target.accountId, this.clock.now());
    this.logger.log({ message: 'accounts.welcomed', accountId: target.accountId });
    return true;
  }

  private termsOf(target: WelcomeTarget): AcceptedTerms | null {
    const url = this.settings.termsUrl;
    return target.termsVersion === null || url === null
      ? null
      : { version: target.termsVersion, url };
  }
}

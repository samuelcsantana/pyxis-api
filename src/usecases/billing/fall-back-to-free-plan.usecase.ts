import { Inject, Injectable, Logger } from '@nestjs/common';
import { eventsPerMonthOf } from '../../domain/accounts/account-limits';
import { fallsBackToFree, fitsFreePlan } from '../../domain/accounts/free-plan-fallback';
import { SIGN_UP_SETTINGS, type SignUpSettings } from '../../domain/accounts/sign-up-settings';
import {
  type AccountBillingState,
  type AccountBillingUpdate,
  endsARunningSubscription,
} from '../../domain/billing/account-billing';
import {
  type BackToFreeTarget,
  FREE_PLAN_FALLBACK_REPOSITORY,
  type FreePlanFallbackRepository,
} from '../../domain/repositories/free-plan-fallback.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { MAIL_SENDER, type MailSender } from '../../domain/services/mail-sender';

@Injectable()
export class FallBackToFreePlanUseCase {
  private readonly logger = new Logger(FallBackToFreePlanUseCase.name);

  constructor(
    @Inject(FREE_PLAN_FALLBACK_REPOSITORY)
    private readonly fallbacks: FreePlanFallbackRepository,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SIGN_UP_SETTINGS) private readonly settings: SignUpSettings,
  ) {}

  async tryFallBack(current: AccountBillingState, update: AccountBillingUpdate): Promise<boolean> {
    if (!this.settings.freePlanOpen || !endsARunningSubscription(current, update)) {
      return false;
    }
    const fit = await this.fallbacks.fitOf(current.accountId);
    const now = this.clock.now();
    if (fit === null || !fallsBackToFree(fit, this.settings, now)) {
      return false;
    }
    if (!(await this.fallbacks.fallBack(current.accountId, now))) {
      return false;
    }
    this.logger.log({
      message: 'billing.fell_back_to_free',
      accountId: current.accountId,
      from: current.status,
    });
    await this.tryNotify(current.accountId);
    return true;
  }

  async tryNotify(accountId: string): Promise<boolean> {
    try {
      const target = await this.fallbacks.toNotify(accountId);
      return target === null ? false : await this.notify(target);
    } catch (error) {
      this.logger.error({
        message: 'accounts.notice_failed',
        kind: 'back_to_free',
        accountId,
        reason: String(error),
      });
      return false;
    }
  }

  async notifyPending(): Promise<number> {
    let notified = 0;
    for (const target of await this.fallbacks.pendingNotices()) {
      if (await this.tryNotify(target.accountId)) {
        notified += 1;
      }
    }
    return notified;
  }

  async settleFitDeadlines(now: Date): Promise<number> {
    let ended = 0;
    for (const { accountId, fit } of await this.fallbacks.fitDeadlinesDue(now)) {
      if (fitsFreePlan(fit)) {
        await this.fallbacks.clearFitDeadline(accountId);
        continue;
      }
      await this.fallbacks.endUnfit(accountId, now);
      ended += 1;
      this.logger.log({ message: 'accounts.unfit_free_account_ended', accountId });
    }
    return ended;
  }

  private async notify(target: BackToFreeTarget): Promise<boolean> {
    await this.mail.sendAccountNotice(
      target.ownerEmail,
      {
        kind: 'back_to_free',
        eventsPerMonth: eventsPerMonthOf({
          status: 'free',
          eventsPerMonthLimit: target.eventsPerMonthLimit,
        }),
      },
      target.ownerLanguage,
    );
    await this.fallbacks.markNotified(target.accountId);
    return true;
  }
}

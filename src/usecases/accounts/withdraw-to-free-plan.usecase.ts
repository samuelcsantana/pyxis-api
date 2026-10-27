import { Inject, Injectable, Logger } from '@nestjs/common';
import { withdrawalWindowStart } from '../../domain/accounts/account-lifecycle';
import { fitsFreePlan, freePlanFitDueAt } from '../../domain/accounts/free-plan-fallback';
import { SIGN_UP_SETTINGS, type SignUpSettings } from '../../domain/accounts/sign-up-settings';
import { BILLING_GATEWAY, type BillingGateway } from '../../domain/billing/billing-gateway';
import {
  FreePlanClosedError,
  WithdrawalUnavailableError,
  WithdrawalWindowClosedError,
} from '../../domain/errors/account.errors';
import {
  ACCOUNT_WITHDRAWAL_REPOSITORY,
  type AccountWithdrawalRepository,
} from '../../domain/repositories/account-withdrawal.repository';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import {
  FREE_PLAN_FALLBACK_REPOSITORY,
  type FreePlanFallbackRepository,
} from '../../domain/repositories/free-plan-fallback.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { MAIL_SENDER, type MailSender } from '../../domain/services/mail-sender';
import type { EmailLanguage } from '../../domain/auth/email-language';
import { ownedAccount } from './owned-account';

export interface WithdrawToFreePlanCommand {
  readonly adminUserId: string;
  readonly ownerEmail: string;
  readonly ownerLanguage: EmailLanguage;
  readonly accountId: string;
}

export interface WithdrawnToFreePlan {
  readonly refundedAmount: number;
  readonly fitBy: Date | null;
}

const PAID_STATUSES: ReadonlySet<string> = new Set(['active', 'past_due', 'ending']);

@Injectable()
export class WithdrawToFreePlanUseCase {
  private readonly logger = new Logger(WithdrawToFreePlanUseCase.name);

  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(ACCOUNT_WITHDRAWAL_REPOSITORY)
    private readonly withdrawals: AccountWithdrawalRepository,
    @Inject(BILLING_GATEWAY) private readonly gateway: BillingGateway,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SIGN_UP_SETTINGS) private readonly settings: SignUpSettings,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
    @Inject(FREE_PLAN_FALLBACK_REPOSITORY)
    private readonly fallbacks: FreePlanFallbackRepository,
  ) {}

  async execute(command: WithdrawToFreePlanCommand): Promise<WithdrawnToFreePlan> {
    const account = await ownedAccount(this.accounts, command.accountId, command.adminUserId);
    if (!this.settings.freePlanOpen) {
      throw new FreePlanClosedError();
    }
    const subscriptionId = await this.withdrawals.subscriptionOf(account.id);
    if (!PAID_STATUSES.has(account.status) || subscriptionId === null) {
      throw new WithdrawalUnavailableError();
    }
    const now = this.clock.now();
    const windowStart = withdrawalWindowStart(now);
    const firstPaymentAt = await this.gateway.firstPaymentAt(subscriptionId);
    if (firstPaymentAt === null || firstPaymentAt < windowStart) {
      throw new WithdrawalWindowClosedError();
    }
    await this.gateway.cancelSubscription(subscriptionId);
    const refundedAmount = await this.tryRefund(account.id, subscriptionId, windowStart);
    const fitBy = await this.fitDeadline(account.id, now);
    await this.withdrawals.returnToFreePlan(account.id, now, fitBy);
    await this.tryNotify(command, { refundedAmount, fitBy });
    this.logger.log({
      message: 'accounts.withdrawn_to_free',
      accountId: account.id,
      refundedAmount,
      fitBy,
    });
    return { refundedAmount, fitBy };
  }

  private async fitDeadline(accountId: string, now: Date): Promise<Date | null> {
    const fit = await this.fallbacks.fitOf(accountId);
    return fit === null || fitsFreePlan(fit) ? null : freePlanFitDueAt(now);
  }

  private async tryNotify(
    command: WithdrawToFreePlanCommand,
    withdrawn: WithdrawnToFreePlan,
  ): Promise<void> {
    try {
      await this.mail.sendAccountNotice(
        command.ownerEmail,
        { kind: 'withdrawn_to_free', ...withdrawn },
        command.ownerLanguage,
      );
    } catch (error) {
      this.logger.error({
        message: 'accounts.notice_failed',
        kind: 'withdrawn_to_free',
        accountId: command.accountId,
        reason: String(error),
      });
    }
  }

  private async tryRefund(accountId: string, subscriptionId: string, since: Date): Promise<number> {
    try {
      return await this.gateway.refundFirstPaymentSince(subscriptionId, since);
    } catch (error) {
      this.logger.error({ message: 'accounts.refund_failed', accountId, reason: String(error) });
      return 0;
    }
  }
}

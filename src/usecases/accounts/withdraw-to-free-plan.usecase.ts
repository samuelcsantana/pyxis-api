import { Inject, Injectable, Logger } from '@nestjs/common';
import { withdrawalWindowStart } from '../../domain/accounts/account-lifecycle';
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
import { CLOCK, type Clock } from '../../domain/services/clock';
import { ownedAccount } from './owned-account';

export interface WithdrawToFreePlanCommand {
  readonly adminUserId: string;
  readonly accountId: string;
}

export interface WithdrawnToFreePlan {
  readonly refundedAmount: number;
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
    await this.withdrawals.returnToFreePlan(account.id);
    this.logger.log({
      message: 'accounts.withdrawn_to_free',
      accountId: account.id,
      refundedAmount,
    });
    return { refundedAmount };
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

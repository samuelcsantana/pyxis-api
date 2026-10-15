import { Inject, Injectable, Logger } from '@nestjs/common';
import { deletionDueAt } from '../../domain/accounts/account-lifecycle';
import { hasRunningSubscription } from '../../domain/accounts/account-status';
import type { Account } from '../../domain/entities/account.entity';
import { BILLING_GATEWAY, type BillingGateway } from '../../domain/billing/billing-gateway';
import { operatorRefundAmount, type RefundMode } from '../../domain/billing/operator-refund';
import { AccountEndedError, AccountNotFoundError } from '../../domain/errors/account.errors';
import {
  ACCOUNT_CLOSURE_REPOSITORY,
  type AccountClosureRepository,
} from '../../domain/repositories/account-closure.repository';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

export interface OperatorClosureCommand {
  readonly accountId: string;
  readonly refund: RefundMode;
}

export interface OperatorClosure {
  readonly accountId: string;
  readonly accessEndsAt: Date;
  readonly deletionOn: Date;
  readonly subscriptionCancelled: boolean;
  readonly refundedAmount: number;
  readonly refundFailed: boolean;
}

interface RefundOutcome {
  readonly refundedAmount: number;
  readonly refundFailed: boolean;
}

const NO_REFUND: RefundOutcome = { refundedAmount: 0, refundFailed: false };

@Injectable()
export class CloseAccountAsOperatorUseCase {
  private readonly logger = new Logger(CloseAccountAsOperatorUseCase.name);

  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(ACCOUNT_CLOSURE_REPOSITORY) private readonly closure: AccountClosureRepository,
    @Inject(BILLING_GATEWAY) private readonly gateway: BillingGateway,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: OperatorClosureCommand): Promise<OperatorClosure> {
    const account = await this.accounts.findById(command.accountId);
    if (account === null) {
      throw new AccountNotFoundError();
    }
    if (account.status === 'ended') {
      throw new AccountEndedError();
    }
    const now = this.clock.now();
    const subscriptionId = await this.closure.subscriptionOf(account.id);
    const cancelling = subscriptionId !== null && hasRunningSubscription(account.status);
    const outcome = cancelling
      ? await this.cancel(account, subscriptionId, command.refund, now)
      : NO_REFUND;
    await this.closure.close(account.id, now);
    this.logger.log({
      message: 'accounts.closed_by_operator',
      accountId: account.id,
      refund: command.refund,
      refundedAmount: outcome.refundedAmount,
    });
    return {
      accountId: account.id,
      accessEndsAt: now,
      deletionOn: deletionDueAt(now),
      subscriptionCancelled: cancelling,
      ...outcome,
    };
  }

  private async cancel(
    account: Account,
    subscriptionId: string,
    mode: RefundMode,
    now: Date,
  ): Promise<RefundOutcome> {
    await this.gateway.cancelSubscription(subscriptionId);
    if (mode === 'none') {
      return NO_REFUND;
    }
    try {
      const invoice = await this.gateway.latestPaidInvoice(subscriptionId);
      const amount =
        invoice === null ? 0 : operatorRefundAmount(mode, invoice, account.suspendedAt ?? now);
      return {
        refundedAmount:
          invoice === null || amount === 0
            ? 0
            : await this.gateway.refundInvoice(invoice.invoiceId, amount),
        refundFailed: false,
      };
    } catch (error) {
      this.logger.error({
        message: 'accounts.refund_failed',
        accountId: account.id,
        reason: String(error),
      });
      return { refundedAmount: 0, refundFailed: true };
    }
  }
}

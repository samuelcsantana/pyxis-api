import { Inject, Injectable, Logger } from '@nestjs/common';
import { deletionDueAt, withdrawalWindowStart } from '../../domain/accounts/account-lifecycle';
import type { AccountStatus } from '../../domain/accounts/account-status';
import { normalizeEmail } from '../../domain/auth/email';
import type { EmailLanguage } from '../../domain/auth/email-language';
import { BILLING_GATEWAY, type BillingGateway } from '../../domain/billing/billing-gateway';
import { AccountEndedError, ConfirmationMismatchError } from '../../domain/errors/account.errors';
import {
  ACCOUNT_CLOSURE_REPOSITORY,
  type AccountClosureRepository,
} from '../../domain/repositories/account-closure.repository';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { MAIL_SENDER, type MailSender } from '../../domain/services/mail-sender';
import { ownedAccount } from './owned-account';

const STATUSES_WITH_A_SUBSCRIPTION: ReadonlySet<AccountStatus> = new Set([
  'trialing',
  'active',
  'past_due',
  'ending',
]);

export interface CloseAccountCommand {
  readonly adminUserId: string;
  readonly ownerEmail: string;
  readonly ownerLanguage: EmailLanguage;
  readonly accountId: string;
  readonly confirmEmail: string;
}

export interface ClosedAccount {
  readonly accessEndsAt: Date;
  readonly deletionOn: Date;
  readonly refundedAmount: number;
}

@Injectable()
export class CloseAccountUseCase {
  private readonly logger = new Logger(CloseAccountUseCase.name);

  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(ACCOUNT_CLOSURE_REPOSITORY) private readonly closure: AccountClosureRepository,
    @Inject(BILLING_GATEWAY) private readonly gateway: BillingGateway,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: CloseAccountCommand): Promise<ClosedAccount> {
    const account = await ownedAccount(this.accounts, command.accountId, command.adminUserId);
    if (account.status === 'ended') {
      throw new AccountEndedError();
    }
    if (normalizeEmail(command.confirmEmail) !== normalizeEmail(command.ownerEmail)) {
      throw new ConfirmationMismatchError();
    }
    const now = this.clock.now();
    const subscriptionId = await this.closure.subscriptionOf(account.id);
    const refundedAmount =
      subscriptionId !== null && STATUSES_WITH_A_SUBSCRIPTION.has(account.status)
        ? await this.cancel(account.id, subscriptionId, now)
        : 0;
    await this.closure.close(account.id, now);
    const deletionOn = deletionDueAt(now);
    await this.tryNotify(command, deletionOn, now);
    this.logger.log({ message: 'accounts.closed', accountId: account.id, refundedAmount });
    return { accessEndsAt: now, deletionOn, refundedAmount };
  }

  private async cancel(accountId: string, subscriptionId: string, now: Date): Promise<number> {
    await this.gateway.cancelSubscription(subscriptionId);
    try {
      return await this.gateway.refundFirstPaymentSince(subscriptionId, withdrawalWindowStart(now));
    } catch (error) {
      this.logger.error({ message: 'accounts.refund_failed', accountId, reason: String(error) });
      return 0;
    }
  }

  private async tryNotify(
    command: CloseAccountCommand,
    deletionOn: Date,
    now: Date,
  ): Promise<void> {
    try {
      await this.mail.sendAccountNotice(
        command.ownerEmail,
        { kind: 'access_ended', deletionOn },
        command.ownerLanguage,
      );
      await this.closure.markEndedNotified(command.accountId, now);
    } catch (error) {
      this.logger.error({
        message: 'accounts.notice_failed',
        kind: 'access_ended',
        accountId: command.accountId,
        reason: String(error),
      });
    }
  }
}

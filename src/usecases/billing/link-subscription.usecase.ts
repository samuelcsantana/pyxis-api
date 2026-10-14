import { Inject, Injectable } from '@nestjs/common';
import { type AccountBillingUpdate, billingUpdateFor } from '../../domain/billing/account-billing';
import { BILLING_GATEWAY, type BillingGateway } from '../../domain/billing/billing-gateway';
import { AccountNotFoundError } from '../../domain/errors/account.errors';
import {
  ACCOUNT_BILLING_REPOSITORY,
  type AccountBillingRepository,
} from '../../domain/repositories/account-billing.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

export interface LinkSubscriptionCommand {
  readonly accountId: string;
  readonly subscriptionId: string;
}

@Injectable()
export class LinkSubscriptionUseCase {
  constructor(
    @Inject(BILLING_GATEWAY) private readonly gateway: BillingGateway,
    @Inject(ACCOUNT_BILLING_REPOSITORY) private readonly accounts: AccountBillingRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: LinkSubscriptionCommand): Promise<AccountBillingUpdate> {
    const account = await this.accounts.find({
      accountId: command.accountId,
      subscriptionId: null,
      customerId: null,
    });
    if (account === null) {
      throw new AccountNotFoundError();
    }
    const subscription = await this.gateway.subscription(command.subscriptionId);
    const update = billingUpdateFor(subscription, account, this.clock.now());
    await this.accounts.apply(account.accountId, update);
    return update;
  }
}

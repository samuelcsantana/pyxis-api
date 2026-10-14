import { Inject, Injectable, Logger } from '@nestjs/common';
import { billingUpdateFor } from '../../domain/billing/account-billing';
import { BILLING_GATEWAY, type BillingGateway } from '../../domain/billing/billing-gateway';
import {
  ACCOUNT_BILLING_REPOSITORY,
  type AccountBillingRepository,
} from '../../domain/repositories/account-billing.repository';
import {
  BILLING_EVENT_REPOSITORY,
  type BillingEventRepository,
} from '../../domain/repositories/billing-event.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

export interface HandleBillingEventCommand {
  readonly rawBody: Buffer;
  readonly signature: string | null;
}

export type BillingEventOutcome = 'applied' | 'duplicate' | 'ignored';

@Injectable()
export class HandleBillingEventUseCase {
  private readonly logger = new Logger(HandleBillingEventUseCase.name);

  constructor(
    @Inject(BILLING_GATEWAY) private readonly gateway: BillingGateway,
    @Inject(BILLING_EVENT_REPOSITORY) private readonly events: BillingEventRepository,
    @Inject(ACCOUNT_BILLING_REPOSITORY) private readonly accounts: AccountBillingRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: HandleBillingEventCommand): Promise<BillingEventOutcome> {
    const event = this.gateway.parseEvent(command.rawBody, command.signature);
    const now = this.clock.now();
    if (!(await this.events.claim(event, now))) {
      return 'duplicate';
    }
    if (event.subscriptionId === null) {
      await this.events.complete(event.id, now);
      return 'ignored';
    }
    const subscription = await this.gateway.subscription(event.subscriptionId);
    const account = await this.accounts.find({
      accountId: subscription.accountId ?? event.accountId,
      subscriptionId: subscription.subscriptionId,
      customerId: subscription.customerId,
    });
    if (account === null) {
      this.logger.warn({
        message: 'billing.event_without_account',
        eventId: event.id,
        type: event.type,
      });
      await this.events.complete(event.id, now);
      return 'ignored';
    }
    const update = billingUpdateFor(subscription, account, now);
    await this.accounts.apply(account.accountId, update);
    await this.events.complete(event.id, now);
    this.logger.log({
      message: 'billing.event_applied',
      eventId: event.id,
      type: event.type,
      accountId: account.accountId,
      status: update.status,
    });
    return 'applied';
  }
}

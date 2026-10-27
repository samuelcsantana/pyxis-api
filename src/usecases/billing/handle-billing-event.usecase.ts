import { Inject, Injectable, Logger } from '@nestjs/common';
import { hasAccess } from '../../domain/accounts/account-status';
import {
  type AccountBillingState,
  type AccountBillingUpdate,
  billingUpdateFor,
  keepsTheFreePlan,
} from '../../domain/billing/account-billing';
import {
  BILLING_GATEWAY,
  type BillingGateway,
  type BillingSubscription,
} from '../../domain/billing/billing-gateway';
import {
  ACCOUNT_BILLING_REPOSITORY,
  type AccountBillingRepository,
} from '../../domain/repositories/account-billing.repository';
import {
  BILLING_EVENT_REPOSITORY,
  type BillingEventRepository,
} from '../../domain/repositories/billing-event.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { WelcomeAccountsUseCase } from '../accounts/welcome-accounts.usecase';
import { ConfirmSubscriptionsUseCase } from './confirm-subscriptions.usecase';
import { DetectRepeatedTrialUseCase } from './detect-repeated-trial.usecase';
import { FallBackToFreePlanUseCase } from './fall-back-to-free-plan.usecase';

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
    private readonly welcomes: WelcomeAccountsUseCase,
    private readonly repeatedTrials: DetectRepeatedTrialUseCase,
    private readonly confirmations: ConfirmSubscriptionsUseCase,
    private readonly fallbacks: FallBackToFreePlanUseCase,
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
    if (keepsTheFreePlan(subscription, account)) {
      this.logger.log({
        message: 'billing.free_plan_kept',
        eventId: event.id,
        type: event.type,
        accountId: account.accountId,
        subscriptionStatus: subscription.status,
      });
      await this.events.complete(event.id, now);
      return 'ignored';
    }
    const update = billingUpdateFor(subscription, account, now);
    const fellBack = await this.fallbacks.tryFallBack(account, update);
    if (!fellBack) {
      await this.applySubscription(account, update, subscription);
    }
    await this.events.complete(event.id, now);
    this.logger.log({
      message: 'billing.event_applied',
      eventId: event.id,
      type: event.type,
      accountId: account.accountId,
      status: fellBack ? 'free' : update.status,
    });
    return 'applied';
  }

  private async applySubscription(
    account: AccountBillingState,
    update: AccountBillingUpdate,
    subscription: BillingSubscription,
  ): Promise<void> {
    await this.accounts.apply(account.accountId, update);
    if (update.restoresAccess && !hasAccess(account.status)) {
      await this.welcomes.tryWelcome(account.accountId);
    }
    if (update.leavesFreePlan !== null) {
      await this.confirmations.tryConfirm(account.accountId);
    }
    await this.repeatedTrials.tryDetect(account.accountId, subscription);
  }
}

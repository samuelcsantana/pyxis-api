import { Inject, Injectable } from '@nestjs/common';
import { TRIAL_DAYS } from '../../domain/accounts/hosted-plan';
import { SIGN_UP_SETTINGS, type SignUpSettings } from '../../domain/accounts/sign-up-settings';
import type { EmailLanguage } from '../../domain/auth/email-language';
import {
  BILLING_GATEWAY,
  type BillingGateway,
  type BillingInterval,
} from '../../domain/billing/billing-gateway';
import { SignUpClosedError, SubscriptionExistsError } from '../../domain/errors/account.errors';
import { BillingUnavailableError } from '../../domain/errors/billing.errors';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import { ownedAccount } from './owned-account';

export interface StartCheckoutCommand {
  readonly adminUserId: string;
  readonly ownerEmail: string;
  readonly accountId: string;
  readonly interval: BillingInterval;
  readonly language: EmailLanguage;
}

const CHECKOUT_STATUSES: ReadonlySet<string> = new Set(['incomplete', 'ended']);

@Injectable()
export class StartCheckoutUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(BILLING_GATEWAY) private readonly gateway: BillingGateway,
    @Inject(SIGN_UP_SETTINGS) private readonly settings: SignUpSettings,
  ) {}

  async execute(command: StartCheckoutCommand): Promise<{ readonly url: string }> {
    if (!this.settings.open) {
      throw new SignUpClosedError();
    }
    const origin = this.settings.dashboardOrigin;
    if (origin === null) {
      throw new BillingUnavailableError('DASHBOARD_ORIGIN is not set');
    }
    const account = await ownedAccount(this.accounts, command.accountId, command.adminUserId);
    if (!CHECKOUT_STATUSES.has(account.status)) {
      throw new SubscriptionExistsError();
    }
    return this.gateway.createCheckout({
      accountId: account.id,
      customerId: account.stripeCustomerId,
      customerEmail: command.ownerEmail,
      interval: command.interval,
      language: command.language,
      trialDays: account.stripeCustomerId === null ? TRIAL_DAYS : null,
      successUrl: `${origin}/welcome?account=${account.id}`,
      cancelUrl: `${origin}/sign-up?step=plan`,
    });
  }
}

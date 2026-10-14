import { Inject, Injectable } from '@nestjs/common';
import { SIGN_UP_SETTINGS, type SignUpSettings } from '../../domain/accounts/sign-up-settings';
import type { EmailLanguage } from '../../domain/auth/email-language';
import { BILLING_GATEWAY, type BillingGateway } from '../../domain/billing/billing-gateway';
import { NoBillingYetError } from '../../domain/errors/account.errors';
import { BillingUnavailableError } from '../../domain/errors/billing.errors';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import { ownedAccount } from './owned-account';

export interface OpenBillingPortalCommand {
  readonly adminUserId: string;
  readonly accountId: string;
  readonly language: EmailLanguage;
}

@Injectable()
export class OpenBillingPortalUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(BILLING_GATEWAY) private readonly gateway: BillingGateway,
    @Inject(SIGN_UP_SETTINGS) private readonly settings: SignUpSettings,
  ) {}

  async execute(command: OpenBillingPortalCommand): Promise<{ readonly url: string }> {
    const origin = this.settings.dashboardOrigin;
    if (origin === null) {
      throw new BillingUnavailableError('DASHBOARD_ORIGIN is not set');
    }
    const account = await ownedAccount(this.accounts, command.accountId, command.adminUserId);
    if (account.stripeCustomerId === null) {
      throw new NoBillingYetError();
    }
    return this.gateway.createPortal(
      account.stripeCustomerId,
      `${origin}/account`,
      command.language,
    );
  }
}

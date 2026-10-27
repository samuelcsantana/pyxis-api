import { SUBSCRIPTION_CONFIRMATION_REPOSITORY } from '../../../domain/repositories/subscription-confirmation.repository';
import { DrizzleSubscriptionConfirmationRepository } from '../../repositories/drizzle-subscription-confirmation.repository';
import { ConfirmSubscriptionsUseCase } from '../../../usecases/billing/confirm-subscriptions.usecase';
import { FallBackToFreePlanUseCase } from '../../../usecases/billing/fall-back-to-free-plan.usecase';
import { FREE_PLAN_FALLBACK_REPOSITORY } from '../../../domain/repositories/free-plan-fallback.repository';
import { DrizzleFreePlanFallbackRepository } from '../../repositories/drizzle-free-plan-fallback.repository';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SIGN_UP_SETTINGS } from '../../../domain/accounts/sign-up-settings';
import { BILLING_GATEWAY } from '../../../domain/billing/billing-gateway';
import { ACCOUNT_WELCOME_REPOSITORY } from '../../../domain/repositories/account-welcome.repository';
import { ACCOUNT_BILLING_REPOSITORY } from '../../../domain/repositories/account-billing.repository';
import { BILLING_EVENT_REPOSITORY } from '../../../domain/repositories/billing-event.repository';
import { TRIAL_CARD_REPOSITORY } from '../../../domain/repositories/trial-card.repository';
import { CLOCK } from '../../../domain/services/clock';
import type { EnvConfig } from '../../../config/env.schema';
import { WelcomeAccountsUseCase } from '../../../usecases/accounts/welcome-accounts.usecase';
import { DetectRepeatedTrialUseCase } from '../../../usecases/billing/detect-repeated-trial.usecase';
import { HandleBillingEventUseCase } from '../../../usecases/billing/handle-billing-event.usecase';
import { createBillingGateway } from '../../billing/create-billing-gateway';
import { SystemClock } from '../../clock/system-clock';
import {
  DrizzleAccountBillingRepository,
  DrizzleBillingEventRepository,
} from '../../repositories/drizzle-account-billing.repository';
import { DrizzleAccountWelcomeRepository } from '../../repositories/drizzle-account-welcome.repository';
import { DrizzleTrialCardRepository } from '../../repositories/drizzle-trial-card.repository';
import { signUpSettingsFromEnv } from '../accounts/sign-up-settings-from-env';
import { AuthModule } from '../auth/auth.module';
import { BillingWebhookController } from './billing-webhook.controller';

@Module({
  imports: [AuthModule],
  controllers: [BillingWebhookController],
  providers: [
    HandleBillingEventUseCase,
    WelcomeAccountsUseCase,
    ConfirmSubscriptionsUseCase,
    FallBackToFreePlanUseCase,
    { provide: FREE_PLAN_FALLBACK_REPOSITORY, useClass: DrizzleFreePlanFallbackRepository },
    {
      provide: SUBSCRIPTION_CONFIRMATION_REPOSITORY,
      useClass: DrizzleSubscriptionConfirmationRepository,
    },
    DetectRepeatedTrialUseCase,
    { provide: TRIAL_CARD_REPOSITORY, useClass: DrizzleTrialCardRepository },
    { provide: ACCOUNT_WELCOME_REPOSITORY, useClass: DrizzleAccountWelcomeRepository },
    {
      provide: SIGN_UP_SETTINGS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) =>
        signUpSettingsFromEnv({
          SIGNUP_OPEN: config.get('SIGNUP_OPEN', { infer: true }),
          TERMS_VERSION: config.get('TERMS_VERSION', { infer: true }),
          TERMS_URL: config.get('TERMS_URL', { infer: true }),
          DASHBOARD_ORIGIN: config.get('DASHBOARD_ORIGIN', { infer: true }),
          FREE_PLAN_OPEN: config.get('FREE_PLAN_OPEN', { infer: true }),
          FREE_ACCOUNTS_MAX: config.get('FREE_ACCOUNTS_MAX', { infer: true }),
          TRIAL_OFFERED: config.get('TRIAL_OFFERED', { infer: true }),
          FREE_PLAN_TERMS_FOR_EARLIER_ACCOUNTS_FROM: config.get(
            'FREE_PLAN_TERMS_FOR_EARLIER_ACCOUNTS_FROM',
            { infer: true },
          ),
        }),
    },

    { provide: CLOCK, useClass: SystemClock },
    { provide: ACCOUNT_BILLING_REPOSITORY, useClass: DrizzleAccountBillingRepository },
    { provide: BILLING_EVENT_REPOSITORY, useClass: DrizzleBillingEventRepository },
    {
      provide: BILLING_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) =>
        createBillingGateway({
          STRIPE_SECRET_KEY: config.get('STRIPE_SECRET_KEY', { infer: true }),
          STRIPE_WEBHOOK_SECRET: config.get('STRIPE_WEBHOOK_SECRET', { infer: true }),
          PROMOTION_CODES_OPEN: config.get('PROMOTION_CODES_OPEN', { infer: true }),
        }),
    },
  ],
  exports: [BILLING_GATEWAY, SIGN_UP_SETTINGS, WelcomeAccountsUseCase],
})
export class BillingModule {}

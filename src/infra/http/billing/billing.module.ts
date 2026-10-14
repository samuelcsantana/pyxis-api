import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BILLING_GATEWAY } from '../../../domain/billing/billing-gateway';
import { ACCOUNT_BILLING_REPOSITORY } from '../../../domain/repositories/account-billing.repository';
import { BILLING_EVENT_REPOSITORY } from '../../../domain/repositories/billing-event.repository';
import { CLOCK } from '../../../domain/services/clock';
import type { EnvConfig } from '../../../config/env.schema';
import { HandleBillingEventUseCase } from '../../../usecases/billing/handle-billing-event.usecase';
import { createBillingGateway } from '../../billing/create-billing-gateway';
import { SystemClock } from '../../clock/system-clock';
import {
  DrizzleAccountBillingRepository,
  DrizzleBillingEventRepository,
} from '../../repositories/drizzle-account-billing.repository';
import { BillingWebhookController } from './billing-webhook.controller';

@Module({
  controllers: [BillingWebhookController],
  providers: [
    HandleBillingEventUseCase,
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
        }),
    },
  ],
  exports: [BILLING_GATEWAY],
})
export class BillingModule {}

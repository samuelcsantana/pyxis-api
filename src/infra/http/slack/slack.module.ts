import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../../config/env.schema';
import { ACCOUNT_REPOSITORY } from '../../../domain/repositories/account.repository';
import { PROJECT_SETTINGS_REPOSITORY } from '../../../domain/repositories/project-settings.repository';
import { SLACK_WEBHOOK_REPOSITORY } from '../../../domain/repositories/slack-webhook.repository';
import { RANDOM_SOURCE, type RandomSource } from '../../../domain/services/random-source';
import { SECRET_BOX } from '../../../domain/services/secret-box';
import { SLACK_SENDER } from '../../../domain/slack/slack-sender';
import { GetSlackWebhookUseCase } from '../../../usecases/slack/get-slack-webhook.usecase';
import { RemoveSlackWebhookUseCase } from '../../../usecases/slack/remove-slack-webhook.usecase';
import { SetSlackWebhookUseCase } from '../../../usecases/slack/set-slack-webhook.usecase';
import { TestSlackWebhookUseCase } from '../../../usecases/slack/test-slack-webhook.usecase';
import { CryptoRandomSource } from '../../random/crypto-random-source';
import { DrizzleAccountRepository } from '../../repositories/drizzle-account.repository';
import { DrizzleProjectSettingsRepository } from '../../repositories/drizzle-project-settings.repository';
import { DrizzleSlackWebhookRepository } from '../../repositories/drizzle-slack-webhook.repository';
import { createSecretBox } from '../../security/aes-gcm-secret-box';
import { createSlackSender } from '../../slack/http-slack-sender';
import { DashboardOriginGuard, SessionGuard } from '../auth/auth.guards';
import { AuthModule } from '../auth/auth.module';
import { ClientAddressThrottlerGuard } from '../rate-limit/client-address-throttler.guard';
import { SlackWebhookController } from './slack-webhook.controller';

@Module({
  imports: [AuthModule],
  controllers: [SlackWebhookController],
  providers: [
    GetSlackWebhookUseCase,
    SetSlackWebhookUseCase,
    RemoveSlackWebhookUseCase,
    TestSlackWebhookUseCase,
    { provide: SLACK_WEBHOOK_REPOSITORY, useClass: DrizzleSlackWebhookRepository },
    { provide: PROJECT_SETTINGS_REPOSITORY, useClass: DrizzleProjectSettingsRepository },
    { provide: ACCOUNT_REPOSITORY, useClass: DrizzleAccountRepository },
    { provide: RANDOM_SOURCE, useClass: CryptoRandomSource },
    {
      provide: SECRET_BOX,
      inject: [ConfigService, RANDOM_SOURCE],
      useFactory: (config: ConfigService<EnvConfig, true>, random: RandomSource) =>
        createSecretBox(config.get('SLACK_WEBHOOK_KEYS', { infer: true }), random),
    },
    {
      provide: SLACK_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) =>
        createSlackSender(config.get('DASHBOARD_ORIGIN', { infer: true })),
    },
    DashboardOriginGuard,
    SessionGuard,
    ClientAddressThrottlerGuard,
  ],
})
export class SlackModule {}

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../../config/env.schema';
import { SIGN_UP_SETTINGS } from '../../../domain/accounts/sign-up-settings';
import { ACCOUNT_REPOSITORY } from '../../../domain/repositories/account.repository';
import { ACCOUNT_USAGE_REPOSITORY } from '../../../domain/repositories/account-usage.repository';
import { ADMIN_SESSION_REPOSITORY } from '../../../domain/repositories/admin-session.repository';
import { OTP_CODE_REPOSITORY } from '../../../domain/repositories/otp-code.repository';
import { TERMS_ACCEPTANCE_REPOSITORY } from '../../../domain/repositories/terms-acceptance.repository';
import { RANDOM_SOURCE } from '../../../domain/services/random-source';
import { CompleteSignUpUseCase } from '../../../usecases/accounts/complete-sign-up.usecase';
import { ListMyAccountsUseCase } from '../../../usecases/accounts/list-my-accounts.usecase';
import { OpenBillingPortalUseCase } from '../../../usecases/accounts/open-billing-portal.usecase';
import { RequestSignUpCodeUseCase } from '../../../usecases/accounts/request-sign-up-code.usecase';
import { StartCheckoutUseCase } from '../../../usecases/accounts/start-checkout.usecase';
import { CryptoRandomSource } from '../../random/crypto-random-source';
import { DrizzleAccountUsageRepository } from '../../repositories/drizzle-account-usage.repository';
import { DrizzleAccountRepository } from '../../repositories/drizzle-account.repository';
import { DrizzleAdminSessionRepository } from '../../repositories/drizzle-admin-session.repository';
import { DrizzleOtpCodeRepository } from '../../repositories/drizzle-otp-code.repository';
import { DrizzleTermsAcceptanceRepository } from '../../repositories/drizzle-terms-acceptance.repository';
import { AuthModule } from '../auth/auth.module';
import { DashboardOriginGuard, SessionGuard } from '../auth/auth.guards';
import { BillingModule } from '../billing/billing.module';
import { AccountsController } from './accounts.controller';
import { SignUpController } from './sign-up.controller';
import { signUpSettingsFromEnv } from './sign-up-settings-from-env';

@Module({
  imports: [AuthModule, BillingModule],
  controllers: [SignUpController, AccountsController],
  providers: [
    RequestSignUpCodeUseCase,
    CompleteSignUpUseCase,
    ListMyAccountsUseCase,
    StartCheckoutUseCase,
    OpenBillingPortalUseCase,
    DashboardOriginGuard,
    SessionGuard,
    { provide: RANDOM_SOURCE, useClass: CryptoRandomSource },
    { provide: OTP_CODE_REPOSITORY, useClass: DrizzleOtpCodeRepository },
    { provide: ADMIN_SESSION_REPOSITORY, useClass: DrizzleAdminSessionRepository },
    { provide: ACCOUNT_REPOSITORY, useClass: DrizzleAccountRepository },
    { provide: ACCOUNT_USAGE_REPOSITORY, useClass: DrizzleAccountUsageRepository },
    { provide: TERMS_ACCEPTANCE_REPOSITORY, useClass: DrizzleTermsAcceptanceRepository },
    {
      provide: SIGN_UP_SETTINGS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) =>
        signUpSettingsFromEnv({
          SIGNUP_OPEN: config.get('SIGNUP_OPEN', { infer: true }),
          TERMS_VERSION: config.get('TERMS_VERSION', { infer: true }),
          DASHBOARD_ORIGIN: config.get('DASHBOARD_ORIGIN', { infer: true }),
        }),
    },
  ],
})
export class AccountsModule {}

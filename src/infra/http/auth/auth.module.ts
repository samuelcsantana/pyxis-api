import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../../config/env.schema';
import { PROJECT_ACTIVITY_QUERY } from '../../../domain/queries/project-activity';
import { PROJECT_RESTRICTIONS_QUERY } from '../../../domain/queries/project-restrictions';
import { ACCESS_TOKEN_REPOSITORY } from '../../../domain/repositories/access-token.repository';
import { ADMIN_SESSION_REPOSITORY } from '../../../domain/repositories/admin-session.repository';
import { ADMIN_USER_REPOSITORY } from '../../../domain/repositories/admin-user.repository';
import { OAUTH_CONNECTION_REPOSITORY } from '../../../domain/repositories/oauth-connection.repository';
import { OTP_CODE_REPOSITORY } from '../../../domain/repositories/otp-code.repository';
import { PROJECT_ACCOUNT_STATE_REPOSITORY } from '../../../domain/repositories/project-account-state.repository';
import { PROJECT_ICON_REPOSITORY } from '../../../domain/repositories/project-icon.repository';
import { REVIEWER_CODE_REPOSITORY } from '../../../domain/repositories/reviewer-code.repository';
import { CLOCK, type Clock } from '../../../domain/services/clock';
import { MAIL_SENDER } from '../../../domain/services/mail-sender';
import { RANDOM_SOURCE } from '../../../domain/services/random-source';
import { AuthenticateAccessTokenUseCase } from '../../../usecases/auth/authenticate-access-token.usecase';
import { AuthenticateSessionUseCase } from '../../../usecases/auth/authenticate-session.usecase';
import { CreateAccessTokenUseCase } from '../../../usecases/auth/create-access-token.usecase';
import { DescribeAdminUseCase } from '../../../usecases/auth/describe-admin.usecase';
import { EndSessionUseCase } from '../../../usecases/auth/end-session.usecase';
import { ListAccessTokensUseCase } from '../../../usecases/auth/list-access-tokens.usecase';
import { ListSessionsUseCase } from '../../../usecases/auth/list-sessions.usecase';
import { RequestSignInCodeUseCase } from '../../../usecases/auth/request-sign-in-code.usecase';
import { RevokeAccessTokenUseCase } from '../../../usecases/auth/revoke-access-token.usecase';
import { SignOutEverywhereUseCase } from '../../../usecases/auth/sign-out-everywhere.usecase';
import { SignOutUseCase } from '../../../usecases/auth/sign-out.usecase';
import { VerifySignInCodeUseCase } from '../../../usecases/auth/verify-sign-in-code.usecase';
import { AuthenticateConnectionTokenUseCase } from '../../../usecases/oauth/authenticate-connection-token.usecase';
import { SystemClock } from '../../clock/system-clock';
import { DRIZZLE_CLIENT } from '../../database/drizzle.constants';
import type { DrizzleDatabase } from '../../database/drizzle.types';
import { createMailSender } from '../../mail/create-mail-sender';
import { DrizzleProjectActivityQuery } from '../../queries/drizzle-project-activity.query';
import { DrizzleProjectRestrictionsQuery } from '../../queries/drizzle-project-restrictions.query';
import { CryptoRandomSource } from '../../random/crypto-random-source';
import { DrizzleAccessTokenRepository } from '../../repositories/drizzle-access-token.repository';
import { DrizzleAdminSessionRepository } from '../../repositories/drizzle-admin-session.repository';
import { DrizzleAdminUserRepository } from '../../repositories/drizzle-admin-user.repository';
import { DrizzleOAuthConnectionRepository } from '../../repositories/drizzle-oauth-connection.repository';
import { DrizzleOtpCodeRepository } from '../../repositories/drizzle-otp-code.repository';
import { DrizzleProjectIconRepository } from '../../repositories/drizzle-project-icon.repository';
import { DrizzleReviewerCodeRepository } from '../../repositories/drizzle-reviewer-code.repository';
import {
  CachingProjectAccountStateRepository,
  DrizzleProjectAccountStateRepository,
} from '../../repositories/drizzle-project-account-state.repository';
import { AccessTokenThrottlerGuard } from './access-token-throttler.guard';
import { AccessTokensController } from './access-tokens.controller';
import { AuthController, MeController } from './auth.controller';
import { DashboardOriginGuard, SessionGuard } from './auth.guards';
import { ReadAccessGuard } from './read-access.guard';

@Module({
  controllers: [AuthController, MeController, AccessTokensController],
  providers: [
    RequestSignInCodeUseCase,
    VerifySignInCodeUseCase,
    AuthenticateSessionUseCase,
    SignOutUseCase,
    SignOutEverywhereUseCase,
    ListSessionsUseCase,
    EndSessionUseCase,
    DescribeAdminUseCase,
    CreateAccessTokenUseCase,
    ListAccessTokensUseCase,
    RevokeAccessTokenUseCase,
    AuthenticateAccessTokenUseCase,
    AuthenticateConnectionTokenUseCase,
    DashboardOriginGuard,
    SessionGuard,
    ReadAccessGuard,
    AccessTokenThrottlerGuard,
    { provide: CLOCK, useClass: SystemClock },
    { provide: RANDOM_SOURCE, useClass: CryptoRandomSource },
    { provide: ADMIN_USER_REPOSITORY, useClass: DrizzleAdminUserRepository },
    { provide: OTP_CODE_REPOSITORY, useClass: DrizzleOtpCodeRepository },
    { provide: REVIEWER_CODE_REPOSITORY, useClass: DrizzleReviewerCodeRepository },
    { provide: ADMIN_SESSION_REPOSITORY, useClass: DrizzleAdminSessionRepository },
    { provide: ACCESS_TOKEN_REPOSITORY, useClass: DrizzleAccessTokenRepository },
    { provide: OAUTH_CONNECTION_REPOSITORY, useClass: DrizzleOAuthConnectionRepository },
    { provide: PROJECT_ACTIVITY_QUERY, useClass: DrizzleProjectActivityQuery },
    { provide: PROJECT_ICON_REPOSITORY, useClass: DrizzleProjectIconRepository },
    { provide: PROJECT_RESTRICTIONS_QUERY, useClass: DrizzleProjectRestrictionsQuery },
    {
      provide: PROJECT_ACCOUNT_STATE_REPOSITORY,
      inject: [DRIZZLE_CLIENT, CLOCK],
      useFactory: (db: DrizzleDatabase, clock: Clock) =>
        new CachingProjectAccountStateRepository(
          new DrizzleProjectAccountStateRepository(db),
          clock,
        ),
    },
    {
      provide: MAIL_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) =>
        createMailSender({
          NODE_ENV: config.get('NODE_ENV', { infer: true }),
          MAIL_PROVIDER: config.get('MAIL_PROVIDER', { infer: true }),
          RESEND_API_KEY: config.get('RESEND_API_KEY', { infer: true }),
          MAIL_FROM: config.get('MAIL_FROM', { infer: true }),
          DASHBOARD_ORIGIN: config.get('DASHBOARD_ORIGIN', { infer: true }),
          SUPPORT_EMAIL: config.get('SUPPORT_EMAIL', { infer: true }),
        }),
    },
  ],
  exports: [
    AuthenticateSessionUseCase,
    AuthenticateAccessTokenUseCase,
    AuthenticateConnectionTokenUseCase,
    ADMIN_USER_REPOSITORY,
    PROJECT_ACCOUNT_STATE_REPOSITORY,
    CLOCK,
    MAIL_SENDER,
  ],
})
export class AuthModule {}

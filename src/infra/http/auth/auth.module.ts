import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../../config/env.schema';
import { PROJECT_ACTIVITY_QUERY } from '../../../domain/queries/project-activity';
import { ADMIN_SESSION_REPOSITORY } from '../../../domain/repositories/admin-session.repository';
import { ADMIN_USER_REPOSITORY } from '../../../domain/repositories/admin-user.repository';
import { OTP_CODE_REPOSITORY } from '../../../domain/repositories/otp-code.repository';
import { CLOCK } from '../../../domain/services/clock';
import { MAIL_SENDER } from '../../../domain/services/mail-sender';
import { RANDOM_SOURCE } from '../../../domain/services/random-source';
import { AuthenticateSessionUseCase } from '../../../usecases/auth/authenticate-session.usecase';
import { DescribeAdminUseCase } from '../../../usecases/auth/describe-admin.usecase';
import { RequestSignInCodeUseCase } from '../../../usecases/auth/request-sign-in-code.usecase';
import { SignOutUseCase } from '../../../usecases/auth/sign-out.usecase';
import { VerifySignInCodeUseCase } from '../../../usecases/auth/verify-sign-in-code.usecase';
import { SystemClock } from '../../clock/system-clock';
import { createMailSender } from '../../mail/create-mail-sender';
import { DrizzleProjectActivityQuery } from '../../queries/drizzle-project-activity.query';
import { CryptoRandomSource } from '../../random/crypto-random-source';
import { DrizzleAdminSessionRepository } from '../../repositories/drizzle-admin-session.repository';
import { DrizzleAdminUserRepository } from '../../repositories/drizzle-admin-user.repository';
import { DrizzleOtpCodeRepository } from '../../repositories/drizzle-otp-code.repository';
import { AuthController, MeController } from './auth.controller';
import { DashboardOriginGuard, SessionGuard } from './auth.guards';

@Module({
  controllers: [AuthController, MeController],
  providers: [
    RequestSignInCodeUseCase,
    VerifySignInCodeUseCase,
    AuthenticateSessionUseCase,
    SignOutUseCase,
    DescribeAdminUseCase,
    DashboardOriginGuard,
    SessionGuard,
    { provide: CLOCK, useClass: SystemClock },
    { provide: RANDOM_SOURCE, useClass: CryptoRandomSource },
    { provide: ADMIN_USER_REPOSITORY, useClass: DrizzleAdminUserRepository },
    { provide: OTP_CODE_REPOSITORY, useClass: DrizzleOtpCodeRepository },
    { provide: ADMIN_SESSION_REPOSITORY, useClass: DrizzleAdminSessionRepository },
    { provide: PROJECT_ACTIVITY_QUERY, useClass: DrizzleProjectActivityQuery },
    {
      provide: MAIL_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) =>
        createMailSender({
          NODE_ENV: config.get('NODE_ENV', { infer: true }),
          RESEND_API_KEY: config.get('RESEND_API_KEY', { infer: true }),
          MAIL_FROM: config.get('MAIL_FROM', { infer: true }),
        }),
    },
  ],
  exports: [AuthenticateSessionUseCase, ADMIN_USER_REPOSITORY, CLOCK],
})
export class AuthModule {}

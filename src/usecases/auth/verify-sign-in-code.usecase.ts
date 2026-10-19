import { Inject, Injectable, Logger } from '@nestjs/common';
import { isSuspended } from '../../domain/accounts/account-suspension';
import { normalizeEmail } from '../../domain/auth/email';
import { sha256Hex } from '../../domain/auth/hashing';
import { generateSessionToken } from '../../domain/auth/session-policy';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import { InvalidSignInCodeError } from '../../domain/errors/auth.errors';
import { type ClientHints, classifyUserAgent } from '../../domain/events/user-agent';
import {
  ADMIN_SESSION_REPOSITORY,
  type AdminSessionRepository,
} from '../../domain/repositories/admin-session.repository';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../domain/repositories/admin-user.repository';
import {
  OTP_CODE_REPOSITORY,
  type OtpCodeRepository,
} from '../../domain/repositories/otp-code.repository';
import {
  REVIEWER_CODE_REPOSITORY,
  type ReviewerCodeRepository,
} from '../../domain/repositories/reviewer-code.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { RANDOM_SOURCE, type RandomSource } from '../../domain/services/random-source';
import { consumeCode } from './consume-code';
import { consumeReviewerCode } from './consume-reviewer-code';

export interface SignInClient {
  readonly userAgent: string | undefined;
  readonly clientHints: ClientHints;
}

export interface SignedIn {
  readonly email: string;
  readonly sessionToken: string;
}

@Injectable()
export class VerifySignInCodeUseCase {
  private readonly logger = new Logger(VerifySignInCodeUseCase.name);

  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository,
    @Inject(OTP_CODE_REPOSITORY) private readonly codes: OtpCodeRepository,
    @Inject(REVIEWER_CODE_REPOSITORY) private readonly reviewerCodes: ReviewerCodeRepository,
    @Inject(ADMIN_SESSION_REPOSITORY) private readonly sessions: AdminSessionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
  ) {}

  async execute(rawEmail: string, code: string, client: SignInClient): Promise<SignedIn> {
    const email = normalizeEmail(rawEmail);
    const now = this.clock.now();
    const admin = await this.admins.findByEmail(email);
    const signedIn =
      admin !== null && (await this.reviewerCodes.findLive(admin.id, now)) !== null
        ? await this.verifyReviewerCode(admin, code, now)
        : await this.verifyEmailedCode(email, admin, code, now);
    const sessionToken = generateSessionToken(this.random);
    await this.sessions.create({
      adminUserId: signedIn.id,
      tokenHash: sha256Hex(sessionToken),
      createdAt: now,
      device: classifyUserAgent(client.userAgent, client.clientHints),
    });
    this.logger.log({ message: 'auth.signed_in', adminUserId: signedIn.id });
    return { email: signedIn.email, sessionToken };
  }

  private async verifyReviewerCode(admin: AdminUser, code: string, now: Date): Promise<AdminUser> {
    if (isSuspended(admin)) {
      throw new InvalidSignInCodeError();
    }
    await consumeReviewerCode(
      this.reviewerCodes,
      { adminUserId: admin.id, code, now },
      this.logger,
    );
    this.logger.log({ message: 'auth.reviewer_code_accepted', adminUserId: admin.id });
    return admin;
  }

  private async verifyEmailedCode(
    email: string,
    admin: AdminUser | null,
    code: string,
    now: Date,
  ): Promise<AdminUser> {
    const latest = await consumeCode(
      this.codes,
      { email, code, purpose: 'sign_in', now },
      this.logger,
    );
    if (admin === null || isSuspended(admin)) {
      throw new InvalidSignInCodeError();
    }
    await this.admins.setEmailLanguage(admin.id, latest.emailLanguage);
    return admin;
  }
}

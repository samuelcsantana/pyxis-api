import { Inject, Injectable, Logger } from '@nestjs/common';
import { normalizeEmail } from '../../domain/auth/email';
import { sha256Hex } from '../../domain/auth/hashing';
import { generateSessionToken } from '../../domain/auth/session-policy';
import { MAX_SIGN_IN_CODE_ATTEMPTS } from '../../domain/auth/sign-in-code';
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
import { CLOCK, type Clock } from '../../domain/services/clock';
import { RANDOM_SOURCE, type RandomSource } from '../../domain/services/random-source';

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
    @Inject(ADMIN_SESSION_REPOSITORY) private readonly sessions: AdminSessionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
  ) {}

  async execute(rawEmail: string, code: string, client: SignInClient): Promise<SignedIn> {
    const email = normalizeEmail(rawEmail);
    const now = this.clock.now();
    const latest = await this.codes.findLatestValid(email, now);
    if (latest === null) {
      throw new InvalidSignInCodeError();
    }
    const withinLimit = await this.codes.consumeAttempt(latest.id, MAX_SIGN_IN_CODE_ATTEMPTS);
    if (!withinLimit || latest.codeHash !== sha256Hex(code)) {
      this.logger.warn({ message: 'auth.invalid_code_attempt' });
      throw new InvalidSignInCodeError();
    }
    if (!(await this.codes.claim(latest.id, now))) {
      throw new InvalidSignInCodeError();
    }
    const admin = await this.admins.findByEmail(email);
    if (admin === null) {
      throw new InvalidSignInCodeError();
    }
    await this.admins.setEmailLanguage(admin.id, latest.emailLanguage);
    const sessionToken = generateSessionToken(this.random);
    await this.sessions.create({
      adminUserId: admin.id,
      tokenHash: sha256Hex(sessionToken),
      createdAt: now,
      device: classifyUserAgent(client.userAgent, client.clientHints),
    });
    this.logger.log({ message: 'auth.signed_in', adminUserId: admin.id });
    return { email: admin.email, sessionToken };
  }
}

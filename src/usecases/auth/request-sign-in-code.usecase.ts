import { Inject, Injectable, Logger } from '@nestjs/common';
import { normalizeEmail } from '../../domain/auth/email';
import { sha256Hex } from '../../domain/auth/hashing';
import {
  generateSignInCode,
  MAX_SIGN_IN_CODES_PER_WINDOW,
  SIGN_IN_CODE_TTL_MS,
  SIGN_IN_CODE_WINDOW_MS,
} from '../../domain/auth/sign-in-code';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../domain/repositories/admin-user.repository';
import {
  OTP_CODE_REPOSITORY,
  type OtpCodeRepository,
} from '../../domain/repositories/otp-code.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { MAIL_SENDER, type MailSender } from '../../domain/services/mail-sender';
import { RANDOM_SOURCE, type RandomSource } from '../../domain/services/random-source';

@Injectable()
export class RequestSignInCodeUseCase {
  private readonly logger = new Logger(RequestSignInCodeUseCase.name);

  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository,
    @Inject(OTP_CODE_REPOSITORY) private readonly codes: OtpCodeRepository,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
  ) {}

  async execute(rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    if ((await this.admins.findByEmail(email)) === null) {
      return;
    }
    const now = this.clock.now();
    const recent = await this.codes.countCreatedSince(
      email,
      new Date(now.getTime() - SIGN_IN_CODE_WINDOW_MS),
    );
    if (recent >= MAX_SIGN_IN_CODES_PER_WINDOW) {
      this.logger.warn({ message: 'auth.code_rate_limited' });
      return;
    }
    const code = generateSignInCode(this.random);
    await this.codes.create({
      email,
      codeHash: sha256Hex(code),
      createdAt: now,
      expiresAt: new Date(now.getTime() + SIGN_IN_CODE_TTL_MS),
    });
    await this.tryDeliverCode(email, code);
  }

  private async tryDeliverCode(email: string, code: string): Promise<void> {
    try {
      await this.mail.sendSignInCode(email, code);
    } catch (error) {
      this.logger.error({
        message: 'auth.code_delivery_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

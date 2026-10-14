import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  SIGN_UP_CODE_WINDOW_MS,
  SIGN_UP_CODES_PER_DAY,
} from '../../domain/accounts/sign-up-policy';
import { SIGN_UP_SETTINGS, type SignUpSettings } from '../../domain/accounts/sign-up-settings';
import { normalizeEmail } from '../../domain/auth/email';
import { resolveEmailLanguage } from '../../domain/auth/email-language';
import { sha256Hex } from '../../domain/auth/hashing';
import {
  generateSignInCode,
  MAX_SIGN_IN_CODES_PER_WINDOW,
  SIGN_IN_CODE_TTL_MS,
  SIGN_IN_CODE_WINDOW_MS,
} from '../../domain/auth/sign-in-code';
import { SignUpClosedError } from '../../domain/errors/account.errors';
import {
  OTP_CODE_REPOSITORY,
  type OtpCodeRepository,
} from '../../domain/repositories/otp-code.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { MAIL_SENDER, type MailSender } from '../../domain/services/mail-sender';
import { RANDOM_SOURCE, type RandomSource } from '../../domain/services/random-source';

@Injectable()
export class RequestSignUpCodeUseCase {
  private readonly logger = new Logger(RequestSignUpCodeUseCase.name);

  constructor(
    @Inject(OTP_CODE_REPOSITORY) private readonly codes: OtpCodeRepository,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
    @Inject(SIGN_UP_SETTINGS) private readonly settings: SignUpSettings,
  ) {}

  async execute(rawEmail: string, requestedLanguage?: string): Promise<void> {
    if (!this.settings.open) {
      throw new SignUpClosedError();
    }
    const email = normalizeEmail(rawEmail);
    const now = this.clock.now();
    if (await this.overLimits(email, now)) {
      return;
    }
    const code = generateSignInCode(this.random);
    const language = resolveEmailLanguage(requestedLanguage);
    await this.codes.create({
      email,
      codeHash: sha256Hex(code),
      emailLanguage: language,
      purpose: 'sign_up',
      createdAt: now,
      expiresAt: new Date(now.getTime() + SIGN_IN_CODE_TTL_MS),
    });
    try {
      await this.mail.sendSignUpCode(email, code, language);
    } catch (error) {
      this.logger.error({ message: 'auth.sign_up_code_delivery_failed', reason: String(error) });
    }
  }

  private async overLimits(email: string, now: Date): Promise<boolean> {
    const forEmail = await this.codes.countCreatedSince(
      email,
      new Date(now.getTime() - SIGN_IN_CODE_WINDOW_MS),
    );
    if (forEmail >= MAX_SIGN_IN_CODES_PER_WINDOW) {
      this.logger.warn({ message: 'auth.code_rate_limited', purpose: 'sign_up' });
      return true;
    }
    const today = await this.codes.countPurposeSince(
      'sign_up',
      new Date(now.getTime() - SIGN_UP_CODE_WINDOW_MS),
    );
    if (today >= SIGN_UP_CODES_PER_DAY) {
      this.logger.warn({ message: 'auth.sign_up_daily_cap', cap: SIGN_UP_CODES_PER_DAY });
      return true;
    }
    return false;
  }
}

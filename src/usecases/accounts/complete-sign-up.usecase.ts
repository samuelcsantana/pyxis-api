import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AccountStatus } from '../../domain/accounts/account-status';
import { isSuspended } from '../../domain/accounts/account-suspension';
import {
  canTakeAFreePlace,
  type FreePlace,
  type FreePlacement,
  freePlaceOf,
} from '../../domain/accounts/free-plan-sign-up';
import { SIGN_UP_SETTINGS, type SignUpSettings } from '../../domain/accounts/sign-up-settings';
import { normalizeEmail } from '../../domain/auth/email';
import { InvalidSignInCodeError } from '../../domain/errors/auth.errors';
import { sha256Hex } from '../../domain/auth/hashing';
import { generateSessionToken } from '../../domain/auth/session-policy';
import type { Account } from '../../domain/entities/account.entity';
import { SignUpClosedError, TermsOutdatedError } from '../../domain/errors/account.errors';
import { classifyUserAgent } from '../../domain/events/user-agent';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
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
  TERMS_ACCEPTANCE_REPOSITORY,
  type TermsAcceptanceRepository,
} from '../../domain/repositories/terms-acceptance.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { RANDOM_SOURCE, type RandomSource } from '../../domain/services/random-source';
import { consumeCode } from '../auth/consume-code';
import { WelcomeAccountsUseCase } from './welcome-accounts.usecase';
import type { SignInClient } from '../auth/verify-sign-in-code.usecase';

export interface CompleteSignUpCommand {
  readonly email: string;
  readonly code: string;
  readonly termsVersion: string;
  readonly client: SignInClient;
}

export interface SignedUp {
  readonly email: string;
  readonly sessionToken: string;
  readonly accountId: string;
  readonly accountStatus: AccountStatus;
  readonly freePlace: FreePlace;
}

interface SignUpAccount {
  readonly account: Account;
  readonly placement: FreePlacement | null;
}

@Injectable()
export class CompleteSignUpUseCase {
  private readonly logger = new Logger(CompleteSignUpUseCase.name);

  constructor(
    @Inject(OTP_CODE_REPOSITORY) private readonly codes: OtpCodeRepository,
    @Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository,
    @Inject(ADMIN_SESSION_REPOSITORY) private readonly sessions: AdminSessionRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(TERMS_ACCEPTANCE_REPOSITORY) private readonly terms: TermsAcceptanceRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
    @Inject(SIGN_UP_SETTINGS) private readonly settings: SignUpSettings,
    private readonly welcomes: WelcomeAccountsUseCase,
  ) {}

  async execute(command: CompleteSignUpCommand): Promise<SignedUp> {
    const termsVersion = this.currentTermsVersion();
    if (command.termsVersion !== termsVersion) {
      throw new TermsOutdatedError(termsVersion);
    }
    const email = normalizeEmail(command.email);
    const now = this.clock.now();
    const code = await consumeCode(
      this.codes,
      { email, code: command.code, purpose: 'sign_up', now },
      this.logger,
    );
    const admin = await this.admins.findOrCreateByEmail(email);
    if (isSuspended(admin)) {
      throw new InvalidSignInCodeError();
    }
    await this.admins.setEmailLanguage(admin.id, code.emailLanguage);
    const { account, placement } = await this.accountFor(admin.id, now);
    const freePlace = freePlaceOf(account, placement);
    await this.terms.record({
      adminUserId: admin.id,
      accountId: account.id,
      version: termsVersion,
      acceptedAt: now,
    });
    if (account.status === 'free') {
      await this.welcomes.tryWelcome(account.id);
    }
    const sessionToken = generateSessionToken(this.random);
    await this.sessions.create({
      adminUserId: admin.id,
      tokenHash: sha256Hex(sessionToken),
      createdAt: now,
      device: classifyUserAgent(command.client.userAgent, command.client.clientHints),
    });
    this.logger.log({
      message: 'auth.signed_up',
      adminUserId: admin.id,
      accountId: account.id,
      accountStatus: account.status,
      freePlace,
    });
    return {
      email: admin.email,
      sessionToken,
      accountId: account.id,
      accountStatus: account.status,
      freePlace,
    };
  }

  private currentTermsVersion(): string {
    if (!this.settings.open || this.settings.termsVersion === null) {
      throw new SignUpClosedError();
    }
    return this.settings.termsVersion;
  }

  private async accountFor(adminUserId: string, now: Date): Promise<SignUpAccount> {
    const live = await this.accounts.liveAccountOwnedBy(adminUserId);
    if (!this.settings.freePlanOpen) {
      const account =
        live ?? (await this.accounts.create({ ownerAdminId: adminUserId, status: 'incomplete' }));
      return { account, placement: null };
    }
    if (live !== null && !canTakeAFreePlace(live)) {
      return { account: live, placement: null };
    }
    return this.accounts.claimFreePlace({
      ownerAdminId: adminUserId,
      accountId: live?.id ?? null,
      freeAccountsMax: this.settings.freeAccountsMax,
      at: now,
    });
  }
}

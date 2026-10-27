import { Inject, Injectable } from '@nestjs/common';
import { type FreePlanState, freePlanStateOf } from '../../domain/accounts/free-plan-sign-up';
import { SIGN_UP_SETTINGS, type SignUpSettings } from '../../domain/accounts/sign-up-settings';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

export interface SignUpStatus {
  readonly open: boolean;
  readonly termsVersion: string | null;
  readonly termsUrl: string | null;
  readonly freePlan: FreePlanState;
}

export const FREE_ACCOUNT_COUNT_TTL_MS = 60_000;

const CLOSED: SignUpStatus = {
  open: false,
  termsVersion: null,
  termsUrl: null,
  freePlan: 'closed',
};

interface CountedFreeAccounts {
  readonly count: number;
  readonly countedAt: number;
}

@Injectable()
export class ReadSignUpStatusUseCase {
  private counted: CountedFreeAccounts | null = null;

  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(SIGN_UP_SETTINGS) private readonly settings: SignUpSettings,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(): Promise<SignUpStatus> {
    if (!this.settings.open) {
      return CLOSED;
    }
    const freeAccounts = this.settings.freePlanOpen ? await this.freeAccountCount() : 0;
    return {
      open: true,
      termsVersion: this.settings.termsVersion,
      termsUrl: this.settings.termsUrl,
      freePlan: freePlanStateOf(this.settings, freeAccounts),
    };
  }

  private async freeAccountCount(): Promise<number> {
    const now = this.clock.now().getTime();
    if (this.counted !== null && now - this.counted.countedAt < FREE_ACCOUNT_COUNT_TTL_MS) {
      return this.counted.count;
    }
    const count = await this.accounts.freeAccountCount();
    this.counted = { count, countedAt: now };
    return count;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { type FreePlanState, freePlanStateOf } from '../../domain/accounts/free-plan-sign-up';
import { SIGN_UP_SETTINGS, type SignUpSettings } from '../../domain/accounts/sign-up-settings';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';

export interface SignUpStatus {
  readonly open: boolean;
  readonly termsVersion: string | null;
  readonly termsUrl: string | null;
  readonly freePlan: FreePlanState;
}

const CLOSED: SignUpStatus = {
  open: false,
  termsVersion: null,
  termsUrl: null,
  freePlan: 'closed',
};

@Injectable()
export class ReadSignUpStatusUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(SIGN_UP_SETTINGS) private readonly settings: SignUpSettings,
  ) {}

  async execute(): Promise<SignUpStatus> {
    if (!this.settings.open) {
      return CLOSED;
    }
    const freeAccounts = this.settings.freePlanOpen ? await this.accounts.freeAccountCount() : 0;
    return {
      open: true,
      termsVersion: this.settings.termsVersion,
      termsUrl: this.settings.termsUrl,
      freePlan: freePlanStateOf(this.settings, freeAccounts),
    };
  }
}

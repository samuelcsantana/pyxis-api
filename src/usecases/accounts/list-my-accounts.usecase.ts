import { Inject, Injectable } from '@nestjs/common';
import {
  ingestionPauseThresholdOf,
  type PlanLimits,
  planLimitsOf,
} from '../../domain/accounts/account-limits';
import { boundByFreePlanTerms } from '../../domain/accounts/free-plan-fallback';
import { SIGN_UP_SETTINGS, type SignUpSettings } from '../../domain/accounts/sign-up-settings';
import type { Account } from '../../domain/entities/account.entity';
import { monthLabelOf } from '../../domain/queries/project-usage';
import {
  type AccountMembership,
  ACCOUNT_REPOSITORY,
  type AccountRepository,
  type AccountRole,
} from '../../domain/repositories/account.repository';
import {
  ACCOUNT_USAGE_REPOSITORY,
  type AccountUsageRepository,
  type RecordedUsage,
} from '../../domain/repositories/account-usage.repository';
import {
  FREE_PLAN_FALLBACK_REPOSITORY,
  type FreePlanFallbackRepository,
} from '../../domain/repositories/free-plan-fallback.repository';
import {
  TERMS_ACCEPTANCE_REPOSITORY,
  type TermsAcceptanceRepository,
} from '../../domain/repositories/terms-acceptance.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

export interface MyAccount {
  readonly account: Account;
  readonly role: AccountRole;
  readonly month: string;
  readonly usage: RecordedUsage | null;
  readonly limits: PlanLimits;
  readonly pauseAtEvents: number;
  readonly held: AccountHoldings | null;
  readonly boundByFreePlanTerms: boolean | null;
  readonly mailboxHasAnotherFreeAccount: boolean | null;
}

export interface AccountHoldings {
  readonly projects: number;
  readonly people: number;
}

@Injectable()
export class ListMyAccountsUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(ACCOUNT_USAGE_REPOSITORY) private readonly usage: AccountUsageRepository,
    @Inject(TERMS_ACCEPTANCE_REPOSITORY) private readonly terms: TermsAcceptanceRepository,
    @Inject(SIGN_UP_SETTINGS) private readonly settings: SignUpSettings,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(FREE_PLAN_FALLBACK_REPOSITORY) private readonly fallbacks: FreePlanFallbackRepository,
  ) {}

  async execute(adminUserId: string): Promise<readonly MyAccount[]> {
    const now = this.clock.now();
    const month = monthLabelOf(now);
    const memberships = await this.accounts.membershipsOf(adminUserId);
    return Promise.all(
      memberships.map(async ({ account, role }) => ({
        account,
        role,
        month,
        usage: await this.usage.recordedFor(account.id, month),
        limits: planLimitsOf(account),
        pauseAtEvents: ingestionPauseThresholdOf(account),
        held: await this.holdingsFor({ account, role }),
        boundByFreePlanTerms: await this.termsBindingFor({ account, role }, now),
        mailboxHasAnotherFreeAccount:
          role === 'owner' ? await this.fallbacks.mailboxHasAnotherFreeAccount(account.id) : null,
      })),
    );
  }

  private async holdingsFor({ account, role }: AccountMembership): Promise<AccountHoldings | null> {
    if (role !== 'owner') {
      return null;
    }
    const [projects, people] = await Promise.all([
      this.accounts.projectsOf(account.id),
      this.accounts.peopleCount(account.id),
    ]);
    return { projects: projects.length, people };
  }

  private async termsBindingFor(
    { account, role }: AccountMembership,
    now: Date,
  ): Promise<boolean | null> {
    if (role !== 'owner') {
      return null;
    }
    const accepted = await this.terms.versionsAcceptedFor(account.id);
    return boundByFreePlanTerms(accepted, this.settings, now);
  }
}

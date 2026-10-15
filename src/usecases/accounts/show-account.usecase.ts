import { Inject, Injectable } from '@nestjs/common';
import { type PlanLimits, planLimitsOf } from '../../domain/accounts/account-limits';
import { AccountNotFoundError } from '../../domain/errors/account.errors';
import { monthLabelOf } from '../../domain/queries/project-usage';
import {
  ACCOUNT_REPOSITORY,
  type AccountOverview,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import {
  ACCOUNT_USAGE_REPOSITORY,
  type AccountUsageRepository,
  type RecordedUsage,
} from '../../domain/repositories/account-usage.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

export interface ShowAccountCommand {
  readonly accountId: string;
}

export interface AccountSummary extends AccountOverview {
  readonly limits: PlanLimits;
  readonly month: string;
  readonly usage: RecordedUsage | null;
}

@Injectable()
export class ShowAccountUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(ACCOUNT_USAGE_REPOSITORY) private readonly usage: AccountUsageRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: ShowAccountCommand): Promise<AccountSummary> {
    const overview = await this.accounts.overviewOf(command.accountId);
    if (overview === null) {
      throw new AccountNotFoundError();
    }
    const month = monthLabelOf(this.clock.now());
    const usage = await this.usage.recordedFor(command.accountId, month);
    return { ...overview, limits: planLimitsOf(overview.account), month, usage };
  }
}

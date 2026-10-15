import { Inject, Injectable } from '@nestjs/common';
import { type PlanLimits, planLimitsOf } from '../../domain/accounts/account-limits';
import type { Account } from '../../domain/entities/account.entity';
import { monthLabelOf } from '../../domain/queries/project-usage';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
  type AccountRole,
} from '../../domain/repositories/account.repository';
import {
  ACCOUNT_USAGE_REPOSITORY,
  type AccountUsageRepository,
  type RecordedUsage,
} from '../../domain/repositories/account-usage.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

export interface MyAccount {
  readonly account: Account;
  readonly role: AccountRole;
  readonly month: string;
  readonly usage: RecordedUsage | null;
  readonly limits: PlanLimits;
}

@Injectable()
export class ListMyAccountsUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(ACCOUNT_USAGE_REPOSITORY) private readonly usage: AccountUsageRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(adminUserId: string): Promise<readonly MyAccount[]> {
    const month = monthLabelOf(this.clock.now());
    const memberships = await this.accounts.membershipsOf(adminUserId);
    return Promise.all(
      memberships.map(async ({ account, role }) => ({
        account,
        role,
        month,
        usage: await this.usage.recordedFor(account.id, month),
        limits: planLimitsOf(account),
      })),
    );
  }
}

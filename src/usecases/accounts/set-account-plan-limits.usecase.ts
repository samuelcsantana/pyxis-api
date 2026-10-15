import { Inject, Injectable } from '@nestjs/common';
import type { PlanLimitChanges } from '../../domain/accounts/account-limits';
import type { Account } from '../../domain/entities/account.entity';
import { AccountNotFoundError } from '../../domain/errors/account.errors';
import {
  ACCOUNT_PLAN_LIMITS_REPOSITORY,
  type AccountPlanLimitsRepository,
} from '../../domain/repositories/account-plan-limits.repository';

export interface PlanLimitsCommand {
  readonly accountId: string;
  readonly changes: PlanLimitChanges;
}

@Injectable()
export class SetAccountPlanLimitsUseCase {
  constructor(
    @Inject(ACCOUNT_PLAN_LIMITS_REPOSITORY)
    private readonly limits: AccountPlanLimitsRepository,
  ) {}

  async execute(command: PlanLimitsCommand): Promise<Account> {
    const account = await this.limits.setPlanLimits(command.accountId, command.changes);
    if (account === null) {
      throw new AccountNotFoundError();
    }
    return account;
  }
}

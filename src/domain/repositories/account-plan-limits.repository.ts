import type { PlanLimitChanges } from '../accounts/account-limits';
import type { Account } from '../entities/account.entity';

export interface AccountPlanLimitsRepository {
  setPlanLimits(accountId: string, changes: PlanLimitChanges): Promise<Account | null>;
}

export const ACCOUNT_PLAN_LIMITS_REPOSITORY = Symbol('AccountPlanLimitsRepository');

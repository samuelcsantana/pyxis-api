import { Inject, Injectable } from '@nestjs/common';
import { HOSTED_PLAN_LIMITS } from '../../domain/accounts/hosted-plan';
import { AccountNotFoundError } from '../../domain/errors/account.errors';
import {
  ACCOUNT_REPOSITORY,
  type AccountOverview,
  type AccountRepository,
} from '../../domain/repositories/account.repository';

export interface ShowAccountCommand {
  readonly accountId: string;
}

export interface AccountSummary extends AccountOverview {
  readonly limits: typeof HOSTED_PLAN_LIMITS;
}

@Injectable()
export class ShowAccountUseCase {
  constructor(@Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository) {}

  async execute(command: ShowAccountCommand): Promise<AccountSummary> {
    const overview = await this.accounts.overviewOf(command.accountId);
    if (overview === null) {
      throw new AccountNotFoundError();
    }
    return { ...overview, limits: HOSTED_PLAN_LIMITS };
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type { Account } from '../../domain/entities/account.entity';
import { AccountNotFoundError } from '../../domain/errors/account.errors';
import {
  ACCOUNT_QUOTA_EXEMPTION_REPOSITORY,
  type AccountQuotaExemptionRepository,
} from '../../domain/repositories/account-quota-exemption.repository';

export interface QuotaPauseExemptionCommand {
  readonly accountId: string;
  readonly until: Date | null;
}

@Injectable()
export class ExemptAccountFromQuotaPauseUseCase {
  constructor(
    @Inject(ACCOUNT_QUOTA_EXEMPTION_REPOSITORY)
    private readonly exemptions: AccountQuotaExemptionRepository,
  ) {}

  async execute(command: QuotaPauseExemptionCommand): Promise<Account> {
    const account =
      command.until === null
        ? await this.exemptions.endPauseExemption(command.accountId)
        : await this.exemptions.exemptFromPause(command.accountId, command.until);
    if (account === null) {
      throw new AccountNotFoundError();
    }
    return account;
  }
}

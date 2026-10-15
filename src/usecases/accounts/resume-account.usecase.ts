import { Inject, Injectable } from '@nestjs/common';
import type { Account } from '../../domain/entities/account.entity';
import { AccountNotFoundError } from '../../domain/errors/account.errors';
import {
  ACCOUNT_SUSPENSION_REPOSITORY,
  type AccountSuspensionRepository,
} from '../../domain/repositories/account-suspension.repository';

export interface ResumeAccountCommand {
  readonly accountId: string;
}

@Injectable()
export class ResumeAccountUseCase {
  constructor(
    @Inject(ACCOUNT_SUSPENSION_REPOSITORY)
    private readonly suspensions: AccountSuspensionRepository,
  ) {}

  async execute(command: ResumeAccountCommand): Promise<Account> {
    const account = await this.suspensions.resume(command.accountId);
    if (account === null) {
      throw new AccountNotFoundError();
    }
    return account;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type { Account } from '../../domain/entities/account.entity';
import { AccountNotFoundError } from '../../domain/errors/account.errors';
import {
  ACCOUNT_DELETION_HOLD_REPOSITORY,
  type AccountDeletionHoldRepository,
} from '../../domain/repositories/account-deletion-hold.repository';

export interface ReleaseAccountDeletionCommand {
  readonly accountId: string;
}

@Injectable()
export class ReleaseAccountDeletionUseCase {
  constructor(
    @Inject(ACCOUNT_DELETION_HOLD_REPOSITORY)
    private readonly holds: AccountDeletionHoldRepository,
  ) {}

  async execute(command: ReleaseAccountDeletionCommand): Promise<Account> {
    const account = await this.holds.release(command.accountId);
    if (account === null) {
      throw new AccountNotFoundError();
    }
    return account;
  }
}

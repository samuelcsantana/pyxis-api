import { Inject, Injectable } from '@nestjs/common';
import type { Account } from '../../domain/entities/account.entity';
import { AccountNotFoundError } from '../../domain/errors/account.errors';
import {
  ACCOUNT_SUSPENSION_REPOSITORY,
  type AccountSuspensionRepository,
} from '../../domain/repositories/account-suspension.repository';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

export interface SuspendedAccount extends Account {
  readonly suspendedAt: Date;
  readonly suspensionReason: string;
}

export interface SuspendAccountCommand {
  readonly accountId: string;
  readonly reason: string;
}

@Injectable()
export class SuspendAccountUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(ACCOUNT_SUSPENSION_REPOSITORY)
    private readonly suspensions: AccountSuspensionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: SuspendAccountCommand): Promise<SuspendedAccount> {
    const account = await this.accounts.findById(command.accountId);
    if (account === null) {
      throw new AccountNotFoundError();
    }
    const suspendedAt = account.suspendedAt ?? this.clock.now();
    const suspended = await this.suspensions.suspend(account.id, command.reason, suspendedAt);
    if (suspended === null) {
      throw new AccountNotFoundError();
    }
    return { ...suspended, suspendedAt, suspensionReason: command.reason };
  }
}

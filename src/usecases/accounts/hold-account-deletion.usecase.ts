import { Inject, Injectable } from '@nestjs/common';
import type { Account } from '../../domain/entities/account.entity';
import { AccountNotFoundError } from '../../domain/errors/account.errors';
import {
  ACCOUNT_DELETION_HOLD_REPOSITORY,
  type AccountDeletionHoldRepository,
} from '../../domain/repositories/account-deletion-hold.repository';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

export interface HeldAccount extends Account {
  readonly deletionHeldAt: Date;
  readonly deletionHoldReason: string;
}

export interface HoldAccountDeletionCommand {
  readonly accountId: string;
  readonly reason: string;
}

@Injectable()
export class HoldAccountDeletionUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(ACCOUNT_DELETION_HOLD_REPOSITORY)
    private readonly holds: AccountDeletionHoldRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: HoldAccountDeletionCommand): Promise<HeldAccount> {
    const account = await this.accounts.findById(command.accountId);
    if (account === null) {
      throw new AccountNotFoundError();
    }
    const deletionHeldAt = account.deletionHeldAt ?? this.clock.now();
    const held = await this.holds.hold(account.id, command.reason, deletionHeldAt);
    if (held === null) {
      throw new AccountNotFoundError();
    }
    return { ...held, deletionHeldAt, deletionHoldReason: command.reason };
  }
}

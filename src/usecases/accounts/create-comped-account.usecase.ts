import { Inject, Injectable } from '@nestjs/common';
import { normalizeEmail } from '../../domain/auth/email';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../domain/repositories/admin-user.repository';

export interface CreateCompedAccountCommand {
  readonly ownerEmail: string;
}

export interface CompedAccount {
  readonly accountId: string;
  readonly ownerAdminId: string;
  readonly ownerEmail: string;
}

@Injectable()
export class CreateCompedAccountUseCase {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
  ) {}

  async execute(command: CreateCompedAccountCommand): Promise<CompedAccount> {
    const owner = await this.admins.findOrCreateByEmail(normalizeEmail(command.ownerEmail));
    const account = await this.accounts.create({ ownerAdminId: owner.id, status: 'comped' });
    return { accountId: account.id, ownerAdminId: owner.id, ownerEmail: owner.email };
  }
}

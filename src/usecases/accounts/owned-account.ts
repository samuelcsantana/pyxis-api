import type { Account } from '../../domain/entities/account.entity';
import { AccountNotFoundError } from '../../domain/errors/account.errors';
import type { AccountRepository } from '../../domain/repositories/account.repository';

export async function ownedAccount(
  accounts: AccountRepository,
  accountId: string,
  adminUserId: string,
): Promise<Account> {
  const account = await accounts.findById(accountId);
  if (account?.ownerAdminId !== adminUserId) {
    throw new AccountNotFoundError();
  }
  return account;
}

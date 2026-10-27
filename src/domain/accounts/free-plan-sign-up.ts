import type { Account } from '../entities/account.entity';

export function canTakeAFreePlace(account: Account): boolean {
  return account.status === 'incomplete';
}

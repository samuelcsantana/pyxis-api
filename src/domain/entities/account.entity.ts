import type { AccountStatus } from '../accounts/account-status';

export interface Account {
  readonly id: string;
  readonly ownerAdminId: string;
  readonly status: AccountStatus;
  readonly createdAt: Date;
}

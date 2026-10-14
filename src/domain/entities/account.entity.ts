import type { AccountStatus } from '../accounts/account-status';

export interface Account {
  readonly id: string;
  readonly ownerAdminId: string;
  readonly status: AccountStatus;
  readonly ingestionPausedUntil: Date | null;
  readonly createdAt: Date;
}

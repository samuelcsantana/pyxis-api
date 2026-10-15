import type { EmailLanguage } from '../auth/email-language';
import type { AccountBillingState } from '../billing/account-billing';

export interface ReconcilableAccount extends AccountBillingState {
  readonly subscriptionId: string;
}

export interface EndedAccount {
  readonly accountId: string;
  readonly ownerAdminId: string;
  readonly ownerEmail: string;
  readonly ownerLanguage: EmailLanguage;
  readonly accessEndsAt: Date;
}

export interface StaleAccount {
  readonly accountId: string;
  readonly ownerAdminId: string;
}

export interface AccountLifecycleRepository {
  reconcilable(): Promise<readonly ReconcilableAccount[]>;
  revokeKeysOfEndedAccounts(now: Date): Promise<number>;
  endedToNotify(now: Date): Promise<readonly EndedAccount[]>;
  markEndedNotified(accountId: string, at: Date): Promise<void>;
  dueForReminder(remindBefore: Date, deleteBefore: Date): Promise<readonly EndedAccount[]>;
  markReminded(accountId: string, at: Date): Promise<void>;
  dueForDeletion(deleteBefore: Date): Promise<readonly EndedAccount[]>;
  staleIncomplete(createdBefore: Date): Promise<readonly StaleAccount[]>;
  peopleOf(accountId: string): Promise<readonly string[]>;
  projectIdsOf(accountId: string): Promise<readonly string[]>;
  deleteEventsOf(projectId: string, limit: number): Promise<number>;
  deleteProject(projectId: string): Promise<void>;
  deleteAccount(accountId: string): Promise<void>;
  deleteAdminsLeftWithout(adminUserIds: readonly string[]): Promise<number>;
}

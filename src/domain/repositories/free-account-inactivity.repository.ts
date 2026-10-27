import type { FreeAccountActivity } from '../accounts/free-account-inactivity';
import type { EmailLanguage } from '../auth/email-language';

export interface FreeAccountToSweep extends FreeAccountActivity {
  readonly accountId: string;
  readonly ownerAdminId: string;
  readonly ownerEmail: string;
  readonly ownerLanguage: EmailLanguage;
  readonly inactivityNotifiedAt: Date | null;
}

export interface FreeAccountInactivityRepository {
  freeAccounts(): Promise<readonly FreeAccountToSweep[]>;
  markNotified(accountId: string, at: Date): Promise<void>;
  clearNotice(accountId: string): Promise<void>;
}

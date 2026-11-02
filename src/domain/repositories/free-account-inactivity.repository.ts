import type { InstallReminderCandidate, ProjectToInstall } from '../accounts/install-reminder';
import type { EmailLanguage } from '../auth/email-language';

export interface FreeAccountToSweep extends InstallReminderCandidate {
  readonly accountId: string;
  readonly ownerAdminId: string;
  readonly ownerEmail: string;
  readonly ownerLanguage: EmailLanguage;
  readonly oldestProjectWithoutEvents: ProjectToInstall | null;
}

export interface FreeAccountInactivityRepository {
  freeAccounts(): Promise<readonly FreeAccountToSweep[]>;
  markNotified(accountId: string, at: Date): Promise<void>;
  clearNotice(accountId: string): Promise<void>;
  markInstallReminded(accountId: string, at: Date): Promise<void>;
}

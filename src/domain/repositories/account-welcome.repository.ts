import type { AccountStatus } from '../accounts/account-status';
import type { EmailLanguage } from '../auth/email-language';

export interface WelcomeTarget {
  readonly accountId: string;
  readonly ownerEmail: string;
  readonly ownerLanguage: EmailLanguage;
  readonly status: AccountStatus;
  readonly trialEndsAt: Date | null;
  readonly termsVersion: string | null;
}

export interface AccountWelcomeRepository {
  toWelcome(accountId: string): Promise<WelcomeTarget | null>;
  pendingWelcomes(): Promise<readonly WelcomeTarget[]>;
  markWelcomed(accountId: string, at: Date): Promise<void>;
}

export const ACCOUNT_WELCOME_REPOSITORY = Symbol('AccountWelcomeRepository');

import type {
  EmailPreferenceChanges,
  EmailPreferences,
} from '../entities/email-preferences.entity';

export interface EmailPreferencesRepository {
  preferencesOf(adminUserId: string, projectId: string): Promise<EmailPreferences | null>;
  save(
    adminUserId: string,
    projectId: string,
    changes: EmailPreferenceChanges,
  ): Promise<EmailPreferences | null>;
}

export const EMAIL_PREFERENCES_REPOSITORY = Symbol('EmailPreferencesRepository');

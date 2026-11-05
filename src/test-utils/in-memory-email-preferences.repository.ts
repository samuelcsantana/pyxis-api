import {
  DEFAULT_EMAIL_PREFERENCES,
  type EmailPreferenceChanges,
  type EmailPreferences,
} from '../domain/entities/email-preferences.entity';
import type { EmailPreferencesRepository } from '../domain/repositories/email-preferences.repository';

function accessKey(adminUserId: string, projectId: string): string {
  return `${adminUserId}:${projectId}`;
}

export class InMemoryEmailPreferencesRepository implements EmailPreferencesRepository {
  private readonly stored = new Map<string, EmailPreferences>();

  grant(adminUserId: string, projectId: string): void {
    this.stored.set(accessKey(adminUserId, projectId), DEFAULT_EMAIL_PREFERENCES);
  }

  preferencesOf(adminUserId: string, projectId: string): Promise<EmailPreferences | null> {
    return Promise.resolve(this.stored.get(accessKey(adminUserId, projectId)) ?? null);
  }

  save(
    adminUserId: string,
    projectId: string,
    changes: EmailPreferenceChanges,
  ): Promise<EmailPreferences | null> {
    const key = accessKey(adminUserId, projectId);
    const current = this.stored.get(key);
    if (current === undefined) {
      return Promise.resolve(null);
    }
    const saved = { ...current, ...changes };
    this.stored.set(key, saved);
    return Promise.resolve(saved);
  }
}

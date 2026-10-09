import {
  type EmailPreferences,
  WEEKLY_DIGEST_BY_DEFAULT,
} from '../domain/entities/email-preferences.entity';
import type { EmailPreferencesRepository } from '../domain/repositories/email-preferences.repository';

function accessKey(adminUserId: string, projectId: string): string {
  return `${adminUserId}:${projectId}`;
}

export class InMemoryEmailPreferencesRepository implements EmailPreferencesRepository {
  private readonly stored = new Map<string, EmailPreferences>();

  grant(adminUserId: string, projectId: string): void {
    this.stored.set(accessKey(adminUserId, projectId), { weeklyDigest: WEEKLY_DIGEST_BY_DEFAULT });
  }

  preferencesOf(adminUserId: string, projectId: string): Promise<EmailPreferences | null> {
    return Promise.resolve(this.stored.get(accessKey(adminUserId, projectId)) ?? null);
  }

  save(
    adminUserId: string,
    projectId: string,
    preferences: EmailPreferences,
  ): Promise<EmailPreferences | null> {
    const key = accessKey(adminUserId, projectId);
    if (!this.stored.has(key)) {
      return Promise.resolve(null);
    }
    const saved = { weeklyDigest: preferences.weeklyDigest };
    this.stored.set(key, saved);
    return Promise.resolve(saved);
  }
}

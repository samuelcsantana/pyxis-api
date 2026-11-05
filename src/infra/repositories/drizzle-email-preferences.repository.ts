import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type {
  EmailPreferenceChanges,
  EmailPreferences,
} from '../../domain/entities/email-preferences.entity';
import type { EmailPreferencesRepository } from '../../domain/repositories/email-preferences.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { adminProjectAccess } from '../database/schema/admins';

const preferenceColumns = {
  weeklyDigest: adminProjectAccess.weeklyDigest,
  noEventsAlert: adminProjectAccess.noEventsAlert,
  failedWritesAlert: adminProjectAccess.failedWritesAlert,
  conversionDropAlert: adminProjectAccess.conversionDropAlert,
};

function accessOf(adminUserId: string, projectId: string) {
  return and(
    eq(adminProjectAccess.adminUserId, adminUserId),
    eq(adminProjectAccess.projectId, projectId),
  );
}

@Injectable()
export class DrizzleEmailPreferencesRepository implements EmailPreferencesRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async preferencesOf(adminUserId: string, projectId: string): Promise<EmailPreferences | null> {
    const [row] = await this.db
      .select(preferenceColumns)
      .from(adminProjectAccess)
      .where(accessOf(adminUserId, projectId))
      .limit(1);
    return row ?? null;
  }

  async save(
    adminUserId: string,
    projectId: string,
    changes: EmailPreferenceChanges,
  ): Promise<EmailPreferences | null> {
    const [row] = await this.db
      .update(adminProjectAccess)
      .set(changes)
      .where(accessOf(adminUserId, projectId))
      .returning(preferenceColumns);
    return row ?? null;
  }
}

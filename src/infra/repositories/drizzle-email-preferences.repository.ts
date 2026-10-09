import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { EmailPreferences } from '../../domain/entities/email-preferences.entity';
import type { EmailPreferencesRepository } from '../../domain/repositories/email-preferences.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { adminProjectAccess } from '../database/schema/admins';

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
      .select({ weeklyDigest: adminProjectAccess.weeklyDigest })
      .from(adminProjectAccess)
      .where(accessOf(adminUserId, projectId))
      .limit(1);
    return row ?? null;
  }

  async save(
    adminUserId: string,
    projectId: string,
    preferences: EmailPreferences,
  ): Promise<EmailPreferences | null> {
    const [row] = await this.db
      .update(adminProjectAccess)
      .set({ weeklyDigest: preferences.weeklyDigest })
      .where(accessOf(adminUserId, projectId))
      .returning({ weeklyDigest: adminProjectAccess.weeklyDigest });
    return row ?? null;
  }
}

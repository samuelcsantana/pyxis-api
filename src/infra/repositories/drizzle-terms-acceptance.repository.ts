import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type {
  TermsAcceptance,
  TermsAcceptanceRepository,
} from '../../domain/repositories/terms-acceptance.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { termsAcceptances } from '../database/schema/accounts';

@Injectable()
export class DrizzleTermsAcceptanceRepository implements TermsAcceptanceRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async record(acceptance: TermsAcceptance): Promise<void> {
    await this.db.insert(termsAcceptances).values(acceptance);
  }

  async versionsAcceptedFor(accountId: string): Promise<readonly string[]> {
    const rows = await this.db
      .selectDistinct({ version: termsAcceptances.version })
      .from(termsAcceptances)
      .where(eq(termsAcceptances.accountId, accountId))
      .orderBy(termsAcceptances.version);
    return rows.map((row) => row.version);
  }
}

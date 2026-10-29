import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { SiteOverlap } from '../../domain/accounts/shared-free-site';
import type { FreeSiteSharingRepository } from '../../domain/repositories/free-site-sharing.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';

@Injectable()
export class DrizzleFreeSiteSharingRepository implements FreeSiteSharingRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async siteOverlapsOfFreeAccounts(): Promise<readonly SiteOverlap[]> {
    const rows = await this.db.execute<{
      -readonly [Key in keyof SiteOverlap]: SiteOverlap[Key];
    }>(sql`
      SELECT DISTINCT free_project.account_id AS "accountId", free_project.id AS "projectId",
             site.origin AS "origin", other_project.id AS "otherProjectId"
      FROM projects AS free_project
      JOIN accounts AS free_account
        ON free_account.id = free_project.account_id AND free_account.status = 'free'
      CROSS JOIN LATERAL unnest(free_project.allowed_origins) AS site(origin)
      JOIN projects AS other_project
        ON site.origin = ANY (other_project.allowed_origins)
       AND other_project.account_id IS DISTINCT FROM free_project.account_id
      LEFT JOIN accounts AS other_account ON other_account.id = other_project.account_id
      WHERE other_account.id IS NULL OR other_account.status <> 'ended'
      ORDER BY "projectId", "otherProjectId", "origin"`);
    return [...rows];
  }
}

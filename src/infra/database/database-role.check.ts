import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE_CLIENT } from './drizzle.constants';
import type { DrizzleDatabase } from './drizzle.types';

interface RoleRow extends Record<string, unknown> {
  readonly role: string;
  readonly can_create: boolean;
}

@Injectable()
export class DatabaseRoleCheck implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseRoleCheck.name);

  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.tryReportDatabaseRole();
  }

  async tryReportDatabaseRole(): Promise<void> {
    try {
      const rows = await this.db.execute<RoleRow>(sql`
        SELECT current_user AS role, has_schema_privilege(current_user, 'public', 'CREATE') AS can_create
      `);
      const [row] = rows;
      if (row === undefined) {
        this.logger.warn('database.role_check_empty');
        return;
      }
      if (row.can_create) {
        this.logger.warn(
          `database.role_can_create { role: "${row.role}" } — the API should connect as the least-privilege APP_DB_ROLE`,
        );
        return;
      }
      this.logger.log(`database.role_ok { role: "${row.role}" }`);
    } catch (error) {
      this.logger.warn(`database.role_check_failed { message: "${errorMessage(error)}" }`);
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

import { sql } from 'drizzle-orm';
import type { DatabaseSizeProbe } from '../../domain/monitoring/database-size';
import type { DrizzleDatabase } from '../database/drizzle.types';

export class PostgresDatabaseSizeProbe implements DatabaseSizeProbe {
  constructor(private readonly db: DrizzleDatabase) {}

  async currentBytes(): Promise<number> {
    const rows = await this.db.execute<{ bytes: string }>(
      sql`SELECT pg_database_size(current_database())::text AS "bytes"`,
    );
    return Number((rows as unknown as readonly [{ bytes: string }])[0].bytes);
  }
}

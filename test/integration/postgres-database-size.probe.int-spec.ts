import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { PostgresDatabaseSizeProbe } from '../../src/infra/repositories/postgres-database-size.probe';
import { migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

describe('database size against a real Postgres', () => {
  let app: postgres.Sql;

  beforeAll(async () => {
    await migrateTestDatabase();
    app = createPostgresClient(testAppUrl());
  });

  afterAll(async () => {
    await app.end();
  });

  it('reads the size of the database the application role is connected to', async () => {
    const bytes = await new PostgresDatabaseSizeProbe(createDrizzleDatabase(app)).currentBytes();
    const [expected] = await app<{ bytes: string }[]>`
      SELECT pg_database_size(current_database())::text AS bytes
    `;

    expect(Number.isInteger(bytes)).toBe(true);
    expect(bytes).toBeGreaterThan(0);
    expect(bytes).toBe(Number(expected?.bytes));
  });
});

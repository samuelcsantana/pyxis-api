import { existsSync } from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import type { MigrationTarget } from './migrations';
import { CONNECT_TIMEOUT_SECONDS } from './postgres-options';

export const MIGRATIONS_FOLDER = 'drizzle';

export function hasMigrations(migrationsFolder: string): boolean {
  return existsSync(path.join(migrationsFolder, 'meta', '_journal.json'));
}

export function createPostgresMigrationTarget(
  connectionString: string,
  migrationsFolder: string = MIGRATIONS_FOLDER,
): MigrationTarget {
  const client = postgres(connectionString, {
    max: 1,
    connect_timeout: CONNECT_TIMEOUT_SECONDS,
    onnotice: () => undefined,
  });
  return {
    runMigrations: async () => {
      if (hasMigrations(migrationsFolder)) {
        await migrate(drizzle(client), { migrationsFolder });
      }
    },
    roleExists: async (role) => {
      const rows = await client<{ exists: boolean }[]>`
        SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${role}) AS exists
      `;
      return rows[0]?.exists === true;
    },
    execute: async (statement) => {
      await client.unsafe(statement);
    },
    close: () => client.end(),
  };
}

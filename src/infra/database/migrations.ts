import type { EnvConfig } from '../../config/env.schema';
import { appRoleGrantStatements } from './app-role-grants';

export interface MigrationTarget {
  runMigrations(): Promise<void>;
  roleExists(role: string): Promise<boolean>;
  execute(statement: string): Promise<void>;
  close(): Promise<void>;
}

export interface MigrationResult {
  readonly grantedTo: string | null;
}

export const MISSING_MIGRATION_URL_MESSAGE =
  'MIGRATION_DATABASE_URL (or DATABASE_URL) is required to run the migrations.';

export function migrationConnectionString(
  env: Pick<EnvConfig, 'MIGRATION_DATABASE_URL' | 'DATABASE_URL'>,
): string {
  const connectionString = env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL;
  if (connectionString === undefined) {
    throw new Error(MISSING_MIGRATION_URL_MESSAGE);
  }
  return connectionString;
}

export async function applyMigrations(
  target: MigrationTarget,
  appRole: string | undefined,
): Promise<MigrationResult> {
  try {
    await target.runMigrations();
    if (appRole === undefined) {
      return { grantedTo: null };
    }
    if (!(await target.roleExists(appRole))) {
      throw new Error(`APP_DB_ROLE "${appRole}" does not exist; create it before migrating.`);
    }
    for (const statement of appRoleGrantStatements(appRole)) {
      await target.execute(statement);
    }
    return { grantedTo: appRole };
  } finally {
    await target.close();
  }
}

import postgres from 'postgres';
import { applyMigrations } from '../../src/infra/database/migrations';
import { createPostgresMigrationTarget } from '../../src/infra/database/postgres-migration-target';
import { appRole } from '../local-database';
import { testOwnerUrl } from './test-database';

export async function migrateTestDatabase(): Promise<void> {
  await applyMigrations(createPostgresMigrationTarget(testOwnerUrl()), appRole());
}

export function connectAsOwner(): postgres.Sql {
  return postgres(testOwnerUrl(), { max: 1, onnotice: () => undefined });
}

export async function emptyIngestionTables(owner: postgres.Sql): Promise<void> {
  await owner.unsafe(
    'TRUNCATE events, project_keys, admin_project_access, admin_sessions, otp_codes, admin_users, projects',
  );
}

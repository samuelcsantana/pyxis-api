import { validateEnv } from './config/env.schema';
import { applyMigrations, migrationConnectionString } from './infra/database/migrations';
import { createPostgresMigrationTarget } from './infra/database/postgres-migration-target';

async function migrateFromCommandLine(): Promise<void> {
  const env = validateEnv(process.env);
  const target = createPostgresMigrationTarget(migrationConnectionString(env));
  const { grantedTo } = await applyMigrations(target, env.APP_DB_ROLE);
  console.log(JSON.stringify({ ok: true, grantedTo }));
}

migrateFromCommandLine().catch((error: unknown) => {
  console.error(JSON.stringify({ ok: false, error: String(error) }));
  process.exitCode = 1;
});

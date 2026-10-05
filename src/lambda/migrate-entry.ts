import { applyMigrations } from '../infra/database/migrations';
import { createPostgresMigrationTarget } from '../infra/database/postgres-migration-target';
import { loadParameters, ssmParameterPages } from './load-parameters';
import { createMigrateHandler } from './migrate-handler';

export const handler = createMigrateHandler({
  loadParameters: () => loadParameters(process.env, ssmParameterPages()),
  migrate: (connectionString, appRole) =>
    applyMigrations(createPostgresMigrationTarget(connectionString), appRole),
  env: process.env,
});

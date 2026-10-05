import { Logger } from '@nestjs/common';
import { type MigrationResult, migrationConnectionString } from '../infra/database/migrations';

export interface MigrateHandlerDependencies {
  readonly loadParameters: () => Promise<unknown>;
  readonly migrate: (
    connectionString: string,
    appRole: string | undefined,
  ) => Promise<MigrationResult>;
  readonly env: NodeJS.ProcessEnv;
}

export interface MigrateOutcome {
  readonly ok: true;
  readonly grantedTo: string | null;
}

const logger = new Logger('LambdaMigrate');

export function createMigrateHandler(
  dependencies: MigrateHandlerDependencies,
): () => Promise<MigrateOutcome> {
  return async () => {
    await dependencies.loadParameters();
    const { env } = dependencies;
    const connectionString = migrationConnectionString({
      MIGRATION_DATABASE_URL: env.MIGRATION_DATABASE_URL,
      DATABASE_URL: undefined,
    });
    const { grantedTo } = await dependencies.migrate(connectionString, env.APP_DB_ROLE);
    logger.log({ message: 'migrations.applied', grantedTo });
    return { ok: true, grantedTo };
  };
}

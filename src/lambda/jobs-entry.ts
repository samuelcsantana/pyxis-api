import { ConsoleLogger, Logger } from '@nestjs/common';
import { SystemClock } from '../infra/clock/system-clock';
import { createDrizzleDatabase, createPostgresClient } from '../infra/database/postgres-client';
import { DrizzleRetentionRepository } from '../infra/repositories/drizzle-retention.repository';
import { PostgresDatabaseSizeProbe } from '../infra/repositories/postgres-database-size.probe';
import { ReportDatabaseSizeUseCase } from '../usecases/monitoring/report-database-size.usecase';
import { RunRetentionUseCase } from '../usecases/retention/run-retention.usecase';
import { createJobsHandler } from './jobs-handler';
import { loadParameters, ssmParameterPages } from './load-parameters';

Logger.overrideLogger(new ConsoleLogger({ json: true }));

async function withDatabase<Result>(
  work: (database: ReturnType<typeof createDrizzleDatabase>) => Promise<Result>,
): Promise<Result> {
  const client = createPostgresClient(process.env.DATABASE_URL);
  try {
    return await work(createDrizzleDatabase(client));
  } finally {
    await client.end();
  }
}

export const handler = createJobsHandler({
  loadParameters: () => loadParameters(process.env, ssmParameterPages()),
  reportDatabaseSize: () =>
    withDatabase((database) =>
      new ReportDatabaseSizeUseCase(new PostgresDatabaseSizeProbe(database)).execute(),
    ),
  runRetention: () =>
    withDatabase((database) =>
      new RunRetentionUseCase(
        new DrizzleRetentionRepository(database),
        new SystemClock(),
      ).execute(),
    ),
});

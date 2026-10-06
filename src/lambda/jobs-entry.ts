import { SystemClock } from '../infra/clock/system-clock';
import { createDrizzleDatabase, createPostgresClient } from '../infra/database/postgres-client';
import { DrizzleRetentionRepository } from '../infra/repositories/drizzle-retention.repository';
import { RunRetentionUseCase } from '../usecases/retention/run-retention.usecase';
import { createJobsHandler } from './jobs-handler';
import { loadParameters, ssmParameterPages } from './load-parameters';

export const handler = createJobsHandler({
  loadParameters: () => loadParameters(process.env, ssmParameterPages()),
  runRetention: async () => {
    const client = createPostgresClient(process.env.DATABASE_URL);
    try {
      const repository = new DrizzleRetentionRepository(createDrizzleDatabase(client));
      return await new RunRetentionUseCase(repository, new SystemClock()).execute();
    } finally {
      await client.end();
    }
  },
});

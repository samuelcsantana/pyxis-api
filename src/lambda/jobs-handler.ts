import type { DatabaseSizeReport } from '../domain/monitoring/database-size';
import type { RetentionReport } from '../usecases/retention/run-retention.usecase';

export interface JobsHandlerDependencies {
  readonly loadParameters: () => Promise<unknown>;
  readonly reportDatabaseSize: () => Promise<DatabaseSizeReport>;
  readonly runRetention: () => Promise<RetentionReport>;
}

export interface JobsOutcome {
  readonly ok: true;
  readonly databaseSize: DatabaseSizeReport;
  readonly retention: RetentionReport;
}

export function createJobsHandler(
  dependencies: JobsHandlerDependencies,
): () => Promise<JobsOutcome> {
  return async () => {
    await dependencies.loadParameters();
    const databaseSize = await dependencies.reportDatabaseSize();
    return { ok: true, databaseSize, retention: await dependencies.runRetention() };
  };
}

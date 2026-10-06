import type { RetentionReport } from '../usecases/retention/run-retention.usecase';

export interface JobsHandlerDependencies {
  readonly loadParameters: () => Promise<unknown>;
  readonly runRetention: () => Promise<RetentionReport>;
}

export interface JobsOutcome {
  readonly ok: true;
  readonly retention: RetentionReport;
}

export function createJobsHandler(
  dependencies: JobsHandlerDependencies,
): () => Promise<JobsOutcome> {
  return async () => {
    await dependencies.loadParameters();
    return { ok: true, retention: await dependencies.runRetention() };
  };
}

import type { DatabaseSizeReport } from '../domain/monitoring/database-size';
import type { DigestReport } from '../usecases/digest/send-weekly-digests.usecase';
import type { RetentionReport } from '../usecases/retention/run-retention.usecase';

export const WEEKLY_DIGEST_JOB = 'weekly-digest';

export interface JobsHandlerDependencies {
  readonly loadParameters: () => Promise<unknown>;
  readonly reportDatabaseSize: () => Promise<DatabaseSizeReport>;
  readonly runRetention: () => Promise<RetentionReport>;
  readonly sendWeeklyDigests: () => Promise<DigestReport>;
}

export type JobsOutcome =
  | {
      readonly ok: true;
      readonly job: 'daily';
      readonly databaseSize: DatabaseSizeReport;
      readonly retention: RetentionReport;
    }
  | {
      readonly ok: true;
      readonly job: typeof WEEKLY_DIGEST_JOB;
      readonly digest: DigestReport;
    };

function asksForWeeklyDigest(event: unknown): boolean {
  return (
    typeof event === 'object' && event !== null && 'job' in event && event.job === WEEKLY_DIGEST_JOB
  );
}

export function createJobsHandler(
  dependencies: JobsHandlerDependencies,
): (event?: unknown) => Promise<JobsOutcome> {
  return async (event) => {
    await dependencies.loadParameters();
    if (asksForWeeklyDigest(event)) {
      return { ok: true, job: WEEKLY_DIGEST_JOB, digest: await dependencies.sendWeeklyDigests() };
    }
    const databaseSize = await dependencies.reportDatabaseSize();
    return { ok: true, job: 'daily', databaseSize, retention: await dependencies.runRetention() };
  };
}

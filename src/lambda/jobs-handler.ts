import { Logger } from '@nestjs/common';
import type { DatabaseSizeReport } from '../domain/monitoring/database-size';
import type { AccountUsageReport } from '../usecases/accounts/measure-account-usage.usecase';
import type { AccountLifecycleReport } from '../usecases/accounts/run-account-lifecycle.usecase';
import type { DigestReport } from '../usecases/digest/send-weekly-digests.usecase';
import type { ProjectIconsReport } from '../usecases/projects/refresh-project-icons.usecase';
import type { RetentionReport } from '../usecases/retention/run-retention.usecase';

export const WEEKLY_DIGEST_JOB = 'weekly-digest';

export interface JobsHandlerDependencies {
  readonly loadParameters: () => Promise<unknown>;
  readonly reportDatabaseSize: () => Promise<DatabaseSizeReport>;
  readonly runRetention: () => Promise<RetentionReport>;
  readonly measureAccountUsage: () => Promise<AccountUsageReport>;
  readonly runAccountLifecycle: () => Promise<AccountLifecycleReport>;
  readonly sendWeeklyDigests: () => Promise<DigestReport>;
  readonly refreshProjectIcons: () => Promise<ProjectIconsReport>;
}

export type JobsOutcome =
  | {
      readonly ok: true;
      readonly job: 'daily';
      readonly databaseSize: DatabaseSizeReport;
      readonly retention: RetentionReport;
      readonly accountUsage: AccountUsageReport;
      readonly accountLifecycle: AccountLifecycleReport;
      readonly projectIcons: ProjectIconsReport | null;
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

const logger = new Logger('JobsHandler');

async function bestEffortRefreshProjectIcons(
  refresh: () => Promise<ProjectIconsReport>,
): Promise<ProjectIconsReport | null> {
  try {
    return await refresh();
  } catch (error) {
    logger.error({
      message: 'jobs.project_icons_failed',
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
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
    const retention = await dependencies.runRetention();
    const accountUsage = await dependencies.measureAccountUsage();
    const accountLifecycle = await dependencies.runAccountLifecycle();
    const projectIcons = await bestEffortRefreshProjectIcons(dependencies.refreshProjectIcons);
    return {
      ok: true,
      job: 'daily',
      databaseSize,
      retention,
      accountUsage,
      accountLifecycle,
      projectIcons,
    };
  };
}

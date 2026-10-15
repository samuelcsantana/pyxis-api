import type { OperatorNoticesReport } from '../usecases/notices/send-operator-notices.usecase';
import { Logger } from '@nestjs/common';
import type { DatabaseSizeReport } from '../domain/monitoring/database-size';
import { EXPORT_JOB } from '../infra/exports/lambda-export-dispatcher';
import type { AccountUsageReport } from '../usecases/accounts/measure-account-usage.usecase';
import type { AccountLifecycleReport } from '../usecases/accounts/run-account-lifecycle.usecase';
import type { DigestReport } from '../usecases/digest/send-weekly-digests.usecase';
import type { ProjectIconsReport } from '../usecases/projects/refresh-project-icons.usecase';
import type { RetentionReport } from '../usecases/retention/run-retention.usecase';
import type {
  ExportOutcome,
  StalledExportsReport,
} from '../usecases/exports/process-project-export.usecase';

export const WEEKLY_DIGEST_JOB = 'weekly-digest';
export const OPERATOR_NOTICES_JOB = 'account-notices';

export interface JobsHandlerDependencies {
  readonly loadParameters: () => Promise<unknown>;
  readonly reportDatabaseSize: () => Promise<DatabaseSizeReport>;
  readonly runRetention: () => Promise<RetentionReport>;
  readonly measureAccountUsage: () => Promise<AccountUsageReport>;
  readonly runAccountLifecycle: () => Promise<AccountLifecycleReport>;
  readonly sendWeeklyDigests: () => Promise<DigestReport>;
  readonly refreshProjectIcons: () => Promise<ProjectIconsReport>;
  readonly processExport: (exportId: string) => Promise<ExportOutcome>;
  readonly processStalledExports: () => Promise<StalledExportsReport>;
  readonly sendOperatorNotices: () => Promise<OperatorNoticesReport>;
}

export type JobsOutcome =
  | {
      readonly ok: true;
      readonly job: 'daily';
      readonly databaseSize: DatabaseSizeReport;
      readonly retention: RetentionReport;
      readonly accountUsage: AccountUsageReport;
      readonly accountLifecycle: AccountLifecycleReport;
      readonly exports: StalledExportsReport;
      readonly operatorNotices: OperatorNoticesReport;
      readonly projectIcons: ProjectIconsReport | null;
    }
  | {
      readonly ok: true;
      readonly job: typeof WEEKLY_DIGEST_JOB;
      readonly digest: DigestReport;
    }
  | {
      readonly ok: true;
      readonly job: typeof OPERATOR_NOTICES_JOB;
      readonly operatorNotices: OperatorNoticesReport;
    }
  | {
      readonly ok: true;
      readonly job: typeof EXPORT_JOB;
      readonly exportId: string;
      readonly outcome: ExportOutcome;
    };

function exportAskedBy(event: unknown): string | null {
  return typeof event === 'object' &&
    event !== null &&
    'job' in event &&
    event.job === EXPORT_JOB &&
    'exportId' in event &&
    typeof event.exportId === 'string'
    ? event.exportId
    : null;
}

function asksFor(job: string, event: unknown): boolean {
  return typeof event === 'object' && event !== null && 'job' in event && event.job === job;
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
    if (asksFor(WEEKLY_DIGEST_JOB, event)) {
      return { ok: true, job: WEEKLY_DIGEST_JOB, digest: await dependencies.sendWeeklyDigests() };
    }
    if (asksFor(OPERATOR_NOTICES_JOB, event)) {
      return {
        ok: true,
        job: OPERATOR_NOTICES_JOB,
        operatorNotices: await dependencies.sendOperatorNotices(),
      };
    }
    const exportId = exportAskedBy(event);
    if (exportId !== null) {
      const outcome = await dependencies.processExport(exportId);
      return { ok: true, job: EXPORT_JOB, exportId, outcome };
    }
    const databaseSize = await dependencies.reportDatabaseSize();
    const retention = await dependencies.runRetention();
    const accountUsage = await dependencies.measureAccountUsage();
    const accountLifecycle = await dependencies.runAccountLifecycle();
    const stalledExports = await dependencies.processStalledExports();
    const operatorNotices = await dependencies.sendOperatorNotices();
    const projectIcons = await bestEffortRefreshProjectIcons(dependencies.refreshProjectIcons);
    return {
      ok: true,
      job: 'daily',
      databaseSize,
      retention,
      accountUsage,
      accountLifecycle,
      exports: stalledExports,
      operatorNotices,
      projectIcons,
    };
  };
}

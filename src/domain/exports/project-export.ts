export const EXPORT_STATUSES = ['pending', 'done', 'failed'] as const;
export type ExportStatus = (typeof EXPORT_STATUSES)[number];

export const EXPORT_BATCH_SIZE = 5_000;
export const EXPORTS_PER_PROJECT_PER_DAY = 3;
export const EXPORT_FILE_DAYS = 7;
export const EXPORT_DOWNLOAD_SECONDS = 300;
export const EXPORT_RETRY_AFTER_MINUTES = 15;

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export interface ProjectExport {
  readonly id: string;
  readonly projectId: string;
  readonly requestedBy: string | null;
  readonly requestedAt: Date;
  readonly status: ExportStatus;
  readonly finishedAt: Date | null;
  readonly objectKey: string | null;
  readonly eventCount: number | null;
}

export function exportAvailableUntil(finishedAt: Date): Date {
  return new Date(finishedAt.getTime() + EXPORT_FILE_DAYS * DAY_MS);
}

export function exportDayStart(now: Date): Date {
  return new Date(now.getTime() - DAY_MS);
}

export function stalledExportCutoff(now: Date): Date {
  return new Date(now.getTime() - EXPORT_RETRY_AFTER_MINUTES * MINUTE_MS);
}

export function exportObjectKey(projectId: string, exportId: string): string {
  return `exports/${projectId}/${exportId}.csv.gz`;
}

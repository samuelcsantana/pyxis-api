import type { EmailLanguage } from '../auth/email-language';
import type { ExportCursor, ExportedEvent } from '../exports/exported-event';
import type { ProjectExport } from '../exports/project-export';

export type ExportRequest =
  | { readonly outcome: 'requested'; readonly projectExport: ProjectExport }
  | { readonly outcome: 'already_pending'; readonly projectExport: ProjectExport }
  | { readonly outcome: 'daily_limit_reached' };

export interface ExportRequestLimits {
  readonly since: Date;
  readonly perDay: number;
}

export interface ExportRequester {
  readonly email: string;
  readonly language: EmailLanguage;
}

export interface ExportTarget {
  readonly projectExport: ProjectExport;
  readonly projectName: string;
  readonly requester: ExportRequester | null;
}

export interface CompletedExport {
  readonly objectKey: string;
  readonly eventCount: number;
  readonly at: Date;
}

export interface ProjectExportRepository {
  request(
    projectId: string,
    requestedBy: string,
    at: Date,
    limits: ExportRequestLimits,
  ): Promise<ExportRequest>;
  findOfProject(projectId: string, exportId: string): Promise<ProjectExport | null>;
  pendingTarget(exportId: string): Promise<ExportTarget | null>;
  stalled(requestedBefore: Date): Promise<readonly string[]>;
  complete(exportId: string, completed: CompletedExport): Promise<void>;
  fail(exportId: string, at: Date): Promise<void>;
}

export interface EventExportSource {
  page(
    projectId: string,
    after: ExportCursor | null,
    limit: number,
  ): Promise<readonly ExportedEvent[]>;
}

export const PROJECT_EXPORT_REPOSITORY = Symbol('ProjectExportRepository');

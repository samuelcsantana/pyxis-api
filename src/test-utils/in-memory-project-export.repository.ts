import type { ExportCursor, ExportedEvent } from '../domain/exports/exported-event';
import type { ProjectExport } from '../domain/exports/project-export';
import type {
  CompletedExport,
  EventExportSource,
  ExportRequest,
  ExportRequester,
  ExportRequestLimits,
  ExportTarget,
  ProjectExportRepository,
} from '../domain/repositories/project-export.repository';
import type { ExportDispatcher, ExportStorage } from '../domain/services/export-storage';

function isAfter(event: ExportedEvent, cursor: ExportCursor): boolean {
  const byTime = event.occurredAt.getTime() - cursor.occurredAt.getTime();
  return byTime > 0 || (byTime === 0 && event.id > cursor.id);
}

export class InMemoryProjectExportRepository implements ProjectExportRepository, EventExportSource {
  private exports: readonly ProjectExport[] = [];
  private readonly events = new Map<string, readonly ExportedEvent[]>();
  private readonly projectNames = new Map<string, string>();
  private readonly requesters = new Map<string, ExportRequester>();
  readonly pagesAsked: (ExportCursor | null)[] = [];

  addProject(projectId: string, name: string, events: readonly ExportedEvent[]): void {
    this.projectNames.set(projectId, name);
    this.events.set(projectId, events);
  }

  addRequester(adminUserId: string, requester: ExportRequester): void {
    this.requesters.set(adminUserId, requester);
  }

  add(projectExport: ProjectExport): void {
    this.exports = [...this.exports, projectExport];
  }

  stored(exportId: string): ProjectExport | undefined {
    return this.exports.find((candidate) => candidate.id === exportId);
  }

  request(
    projectId: string,
    requestedBy: string,
    at: Date,
    limits: ExportRequestLimits,
  ): Promise<ExportRequest> {
    const ofProject = this.exports.filter((candidate) => candidate.projectId === projectId);
    const pending = ofProject.find((candidate) => candidate.status === 'pending');
    if (pending !== undefined) {
      return Promise.resolve({ outcome: 'already_pending', projectExport: pending });
    }
    if (
      ofProject.filter((candidate) => candidate.requestedAt >= limits.since).length >= limits.perDay
    ) {
      return Promise.resolve({ outcome: 'daily_limit_reached' });
    }
    const created: ProjectExport = {
      id: `e0000000-0000-4000-8000-${String(this.exports.length + 1).padStart(12, '0')}`,
      projectId,
      requestedBy,
      requestedAt: at,
      status: 'pending',
      finishedAt: null,
      objectKey: null,
      eventCount: null,
    };
    this.add(created);
    return Promise.resolve({ outcome: 'requested', projectExport: created });
  }

  findOfProject(projectId: string, exportId: string): Promise<ProjectExport | null> {
    const found = this.stored(exportId);
    return Promise.resolve(found?.projectId === projectId ? found : null);
  }

  pendingTarget(exportId: string): Promise<ExportTarget | null> {
    const found = this.stored(exportId);
    if (found?.status !== 'pending') {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      projectExport: found,
      projectName: this.projectNames.get(found.projectId) ?? found.projectId,
      requester:
        found.requestedBy === null ? null : (this.requesters.get(found.requestedBy) ?? null),
    });
  }

  stalled(requestedBefore: Date): Promise<readonly string[]> {
    return Promise.resolve(
      this.exports
        .filter(
          (candidate) => candidate.status === 'pending' && candidate.requestedAt < requestedBefore,
        )
        .map((candidate) => candidate.id),
    );
  }

  complete(exportId: string, completed: CompletedExport): Promise<void> {
    this.update(exportId, {
      status: 'done',
      finishedAt: completed.at,
      objectKey: completed.objectKey,
      eventCount: completed.eventCount,
    });
    return Promise.resolve();
  }

  fail(exportId: string, at: Date): Promise<void> {
    this.update(exportId, { status: 'failed', finishedAt: at });
    return Promise.resolve();
  }

  page(
    projectId: string,
    after: ExportCursor | null,
    limit: number,
  ): Promise<readonly ExportedEvent[]> {
    this.pagesAsked.push(after);
    const sorted = [...(this.events.get(projectId) ?? [])].sort(
      (left, right) =>
        left.occurredAt.getTime() - right.occurredAt.getTime() || left.id.localeCompare(right.id),
    );
    return Promise.resolve(
      sorted.filter((event) => after === null || isAfter(event, after)).slice(0, limit),
    );
  }

  private update(exportId: string, changes: Partial<ProjectExport>): void {
    this.exports = this.exports.map((candidate) =>
      candidate.id === exportId ? { ...candidate, ...changes } : candidate,
    );
  }
}

export class InMemoryExportStorage implements ExportStorage {
  readonly files = new Map<string, { readonly fileName: string; readonly content: string }>();
  failure: Error | null = null;

  async writeCsv(key: string, fileName: string, lines: AsyncIterable<string>): Promise<void> {
    let content = '';
    for await (const line of lines) {
      if (this.failure !== null) {
        throw this.failure;
      }
      content += line;
    }
    this.files.set(key, { fileName, content });
  }

  downloadUrl(key: string, seconds: number): Promise<string> {
    return Promise.resolve(`https://storage.example.com/${key}?expires=${String(seconds)}`);
  }
}

export class RecordingExportDispatcher implements ExportDispatcher {
  readonly dispatched: string[] = [];
  failure: Error | null = null;

  dispatch(exportId: string): Promise<void> {
    if (this.failure !== null) {
      return Promise.reject(this.failure);
    }
    this.dispatched.push(exportId);
    return Promise.resolve();
  }
}

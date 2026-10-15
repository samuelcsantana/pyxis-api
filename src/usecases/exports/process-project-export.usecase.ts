import { Logger } from '@nestjs/common';
import { EVENT_CSV_HEADER, eventCsvLine } from '../../domain/exports/event-csv';
import type { ExportCursor } from '../../domain/exports/exported-event';
import {
  EXPORT_BATCH_SIZE,
  exportAvailableUntil,
  exportObjectKey,
  stalledExportCutoff,
} from '../../domain/exports/project-export';
import type {
  EventExportSource,
  ExportTarget,
  ProjectExportRepository,
} from '../../domain/repositories/project-export.repository';
import type { Clock } from '../../domain/services/clock';
import type { ExportStorage } from '../../domain/services/export-storage';
import type { MailSender } from '../../domain/services/mail-sender';

export type ExportOutcome = 'done' | 'skipped';

export interface StalledExportsReport {
  readonly done: number;
  readonly failed: number;
}

const FILE_NAME_UNSAFE = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;
const DATE_LENGTH = 10;

export function exportFileName(projectName: string, at: Date): string {
  const slug = projectName.toLowerCase().replace(FILE_NAME_UNSAFE, '-').replace(EDGE_DASHES, '');
  const day = at.toISOString().slice(0, DATE_LENGTH);
  return `pyxis-${slug === '' ? 'project' : slug}-${day}.csv.gz`;
}

export class ProcessProjectExportUseCase {
  private readonly logger = new Logger(ProcessProjectExportUseCase.name);

  constructor(
    private readonly exports: ProjectExportRepository,
    private readonly source: EventExportSource,
    private readonly storage: ExportStorage,
    private readonly mail: MailSender,
    private readonly clock: Clock,
  ) {}

  async execute(exportId: string): Promise<ExportOutcome> {
    const target = await this.exports.pendingTarget(exportId);
    if (target === null) {
      return 'skipped';
    }
    const { projectExport } = target;
    const objectKey = exportObjectKey(projectExport.projectId, projectExport.id);
    const counter = { events: 0 };
    try {
      await this.storage.writeCsv(
        objectKey,
        exportFileName(target.projectName, this.clock.now()),
        this.lines(projectExport.projectId, counter),
      );
    } catch (error) {
      await this.exports.fail(exportId, this.clock.now());
      this.logger.error({ message: 'exports.failed', exportId, reason: String(error) });
      throw error;
    }
    const finishedAt = this.clock.now();
    await this.exports.complete(exportId, {
      objectKey,
      eventCount: counter.events,
      at: finishedAt,
    });
    this.logger.log({ message: 'exports.done', exportId, events: counter.events });
    await this.tryNotify(target, counter.events, finishedAt);
    return 'done';
  }

  async processStalled(): Promise<StalledExportsReport> {
    let done = 0;
    let failed = 0;
    for (const exportId of await this.exports.stalled(stalledExportCutoff(this.clock.now()))) {
      try {
        if ((await this.execute(exportId)) === 'done') {
          done += 1;
        }
      } catch {
        failed += 1;
      }
    }
    return { done, failed };
  }

  private async *lines(projectId: string, counter: { events: number }): AsyncGenerator<string> {
    yield EVENT_CSV_HEADER;
    let after: ExportCursor | null = null;
    for (;;) {
      const page = await this.source.page(projectId, after, EXPORT_BATCH_SIZE);
      for (const event of page) {
        yield eventCsvLine(event);
      }
      counter.events += page.length;
      const last = page.at(-1);
      if (last === undefined || page.length < EXPORT_BATCH_SIZE) {
        return;
      }
      after = { occurredAt: last.occurredAt, id: last.id };
    }
  }

  private async tryNotify(
    target: ExportTarget,
    eventCount: number,
    finishedAt: Date,
  ): Promise<void> {
    if (target.requester === null) {
      return;
    }
    try {
      await this.mail.sendExportReady(
        target.requester.email,
        {
          projectId: target.projectExport.projectId,
          exportId: target.projectExport.id,
          projectName: target.projectName,
          eventCount,
          availableUntil: exportAvailableUntil(finishedAt),
        },
        target.requester.language,
      );
    } catch (error) {
      this.logger.error({
        message: 'exports.notice_failed',
        exportId: target.projectExport.id,
        reason: String(error),
      });
    }
  }
}

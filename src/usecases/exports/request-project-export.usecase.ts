import { Inject, Injectable, Logger } from '@nestjs/common';
import { ExportLimitReachedError } from '../../domain/errors/export.errors';
import {
  EXPORTS_PER_PROJECT_PER_DAY,
  exportDayStart,
  type ProjectExport,
} from '../../domain/exports/project-export';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import {
  PROJECT_EXPORT_REPOSITORY,
  type ProjectExportRepository,
} from '../../domain/repositories/project-export.repository';
import {
  PROJECT_SETTINGS_REPOSITORY,
  type ProjectSettingsRepository,
} from '../../domain/repositories/project-settings.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { EXPORT_DISPATCHER, type ExportDispatcher } from '../../domain/services/export-storage';
import { projectOwnedBy } from '../projects/owned-project';

export interface RequestProjectExportCommand {
  readonly adminUserId: string;
  readonly projectId: string;
}

export interface RequestedExport {
  readonly projectExport: ProjectExport;
  readonly requested: boolean;
}

@Injectable()
export class RequestProjectExportUseCase {
  private readonly logger = new Logger(RequestProjectExportUseCase.name);

  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(PROJECT_EXPORT_REPOSITORY) private readonly exports: ProjectExportRepository,
    @Inject(EXPORT_DISPATCHER) private readonly dispatcher: ExportDispatcher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: RequestProjectExportCommand): Promise<RequestedExport> {
    await projectOwnedBy(this.projects, this.accounts, command.projectId, command.adminUserId);
    const now = this.clock.now();
    const request = await this.exports.request(command.projectId, command.adminUserId, now, {
      since: exportDayStart(now),
      perDay: EXPORTS_PER_PROJECT_PER_DAY,
    });
    switch (request.outcome) {
      case 'daily_limit_reached':
        throw new ExportLimitReachedError(EXPORTS_PER_PROJECT_PER_DAY);
      case 'already_pending':
        return { projectExport: request.projectExport, requested: false };
      case 'requested':
        await this.tryDispatch(request.projectExport.id);
        return { projectExport: request.projectExport, requested: true };
    }
  }

  private async tryDispatch(exportId: string): Promise<void> {
    try {
      await this.dispatcher.dispatch(exportId);
    } catch (error) {
      this.logger.error({ message: 'exports.dispatch_failed', exportId, reason: String(error) });
    }
  }
}

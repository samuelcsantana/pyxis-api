import { Inject, Injectable } from '@nestjs/common';
import { ExportNotFoundError } from '../../domain/errors/export.errors';
import {
  EXPORT_DOWNLOAD_SECONDS,
  exportAvailableUntil,
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
import { EXPORT_STORAGE, type ExportStorage } from '../../domain/services/export-storage';
import { projectOwnedBy } from '../projects/owned-project';

export interface GetProjectExportCommand {
  readonly adminUserId: string;
  readonly projectId: string;
  readonly exportId: string;
}

export interface ProjectExportView {
  readonly projectExport: ProjectExport;
  readonly availableUntil: Date | null;
  readonly downloadUrl: string | null;
}

@Injectable()
export class GetProjectExportUseCase {
  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(PROJECT_EXPORT_REPOSITORY) private readonly exports: ProjectExportRepository,
    @Inject(EXPORT_STORAGE) private readonly storage: ExportStorage,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: GetProjectExportCommand): Promise<ProjectExportView> {
    await projectOwnedBy(this.projects, this.accounts, command.projectId, command.adminUserId);
    const found = await this.exports.findOfProject(command.projectId, command.exportId);
    if (found === null) {
      throw new ExportNotFoundError();
    }
    const { finishedAt, objectKey } = found;
    if (finishedAt === null || objectKey === null) {
      return { projectExport: found, availableUntil: null, downloadUrl: null };
    }
    const availableUntil = exportAvailableUntil(finishedAt);
    const downloadUrl =
      this.clock.now() < availableUntil
        ? await this.storage.downloadUrl(objectKey, EXPORT_DOWNLOAD_SECONDS)
        : null;
    return { projectExport: found, availableUntil, downloadUrl };
  }
}

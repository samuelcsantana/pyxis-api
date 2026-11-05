import { Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import {
  PROJECT_SETTINGS_REPOSITORY,
  type ProjectSettingsRepository,
} from '../../domain/repositories/project-settings.repository';
import {
  SHARE_LINK_REPOSITORY,
  type ShareLinkRepository,
} from '../../domain/repositories/share-link.repository';
import type { ShareLink } from '../../domain/share-links/share-link';
import { projectOwnedBy } from '../projects/owned-project';

export interface ListShareLinksCommand {
  readonly adminUserId: string;
  readonly projectId: string;
}

@Injectable()
export class ListShareLinksUseCase {
  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(SHARE_LINK_REPOSITORY) private readonly links: ShareLinkRepository,
  ) {}

  async execute(command: ListShareLinksCommand): Promise<readonly ShareLink[]> {
    const { project } = await projectOwnedBy(
      this.projects,
      this.accounts,
      command.projectId,
      command.adminUserId,
    );
    return this.links.listByProject(project.id);
  }
}

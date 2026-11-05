import { Inject, Injectable, Logger } from '@nestjs/common';
import { ShareLinkNotFoundError } from '../../domain/errors/share-link.errors';
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
import { projectOwnedBy } from '../projects/owned-project';

export interface RevokeShareLinkCommand {
  readonly adminUserId: string;
  readonly projectId: string;
  readonly linkId: string;
}

@Injectable()
export class RevokeShareLinkUseCase {
  private readonly logger = new Logger(RevokeShareLinkUseCase.name);

  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(SHARE_LINK_REPOSITORY) private readonly links: ShareLinkRepository,
  ) {}

  async execute(command: RevokeShareLinkCommand): Promise<void> {
    const { project } = await projectOwnedBy(
      this.projects,
      this.accounts,
      command.projectId,
      command.adminUserId,
    );
    if (!(await this.links.delete(project.id, command.linkId))) {
      throw new ShareLinkNotFoundError();
    }
    this.logger.log({
      message: 'share_link.revoked',
      projectId: project.id,
      shareLinkId: command.linkId,
    });
  }
}

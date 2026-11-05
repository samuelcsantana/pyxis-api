import { Inject, Injectable, Logger } from '@nestjs/common';
import { requireProFeature } from '../../domain/accounts/pro-features';
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
import { PASSWORD_HASHER, type PasswordHasher } from '../../domain/services/password-hasher';
import type { ShareLink } from '../../domain/share-links/share-link';
import { requireSharePassword } from '../../domain/share-links/share-unlock';
import { changeableProject } from '../projects/owned-project';

export interface SetShareLinkPasswordCommand {
  readonly adminUserId: string;
  readonly projectId: string;
  readonly linkId: string;
  readonly password: string | null;
}

@Injectable()
export class SetShareLinkPasswordUseCase {
  private readonly logger = new Logger(SetShareLinkPasswordUseCase.name);

  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(SHARE_LINK_REPOSITORY) private readonly links: ShareLinkRepository,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasher,
  ) {}

  async execute(command: SetShareLinkPasswordCommand): Promise<ShareLink> {
    const password = command.password === null ? null : requireSharePassword(command.password);
    const owned = await changeableProject(
      this.projects,
      this.accounts,
      command.projectId,
      command.adminUserId,
    );
    requireProFeature(owned.account, 'public_share_link');
    const passwordHash = password === null ? null : await this.passwords.hash(password);
    const link = await this.links.setPassword(owned.project.id, command.linkId, passwordHash);
    if (link === null) {
      throw new ShareLinkNotFoundError();
    }
    this.logger.log({
      message: 'share_link.password_changed',
      projectId: owned.project.id,
      shareLinkId: link.id,
      passwordProtected: link.passwordProtected,
    });
    return link;
  }
}

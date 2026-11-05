import { Inject, Injectable, Logger } from '@nestjs/common';
import { requireProFeature } from '../../domain/accounts/pro-features';
import { sha256Hex } from '../../domain/auth/hashing';
import { ShareLinkLimitReachedError } from '../../domain/errors/share-link.errors';
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
import { CLOCK, type Clock } from '../../domain/services/clock';
import { RANDOM_SOURCE, type RandomSource } from '../../domain/services/random-source';
import {
  generateShareToken,
  MAX_SHARE_LINKS_PER_PROJECT,
  requireShareLinkExpiry,
  requireShareLinkName,
  type ShareLink,
} from '../../domain/share-links/share-link';
import { changeableProject } from '../projects/owned-project';

export interface CreateShareLinkCommand {
  readonly adminUserId: string;
  readonly projectId: string;
  readonly name: string;
  readonly expiresAt: Date | null;
}

export interface CreatedShareLink {
  readonly link: ShareLink;
  readonly token: string;
}

@Injectable()
export class CreateShareLinkUseCase {
  private readonly logger = new Logger(CreateShareLinkUseCase.name);

  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(SHARE_LINK_REPOSITORY) private readonly links: ShareLinkRepository,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: CreateShareLinkCommand): Promise<CreatedShareLink> {
    const now = this.clock.now();
    const draft = {
      name: requireShareLinkName(command.name),
      expiresAt: requireShareLinkExpiry(command.expiresAt, now),
    };
    const owned = await changeableProject(
      this.projects,
      this.accounts,
      command.projectId,
      command.adminUserId,
    );
    requireProFeature(owned.account, 'public_share_link');
    const token = generateShareToken(this.random);
    const created = await this.links.create(
      { ...draft, projectId: owned.project.id, tokenHash: sha256Hex(token), createdAt: now },
      MAX_SHARE_LINKS_PER_PROJECT,
    );
    if (created.outcome === 'limit_reached') {
      throw new ShareLinkLimitReachedError(MAX_SHARE_LINKS_PER_PROJECT);
    }
    this.logger.log({
      message: 'share_link.created',
      projectId: owned.project.id,
      shareLinkId: created.link.id,
    });
    return { link: created.link, token };
  }
}

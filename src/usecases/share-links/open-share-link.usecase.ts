import { Inject, Injectable } from '@nestjs/common';
import { mayUseProFeatures } from '../../domain/accounts/pro-features';
import { isSuspended } from '../../domain/accounts/account-suspension';
import { sha256Hex } from '../../domain/auth/hashing';
import type { Account } from '../../domain/entities/account.entity';
import type { Project } from '../../domain/entities/project.entity';
import { ShareLinkNotFoundError } from '../../domain/errors/share-link.errors';
import type { Goal } from '../../domain/goals/goal';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import { GOAL_REPOSITORY, type GoalRepository } from '../../domain/repositories/goal.repository';
import {
  PROJECT_SETTINGS_REPOSITORY,
  type ProjectSettingsRepository,
} from '../../domain/repositories/project-settings.repository';
import {
  SHARE_LINK_REPOSITORY,
  type ShareLinkRepository,
} from '../../domain/repositories/share-link.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { isShareLinkOpen, isShareToken, type ShareLink } from '../../domain/share-links/share-link';

export interface SharedProject {
  readonly link: ShareLink;
  readonly project: Project;
  readonly goals: readonly Goal[];
}

type AccountLookup =
  { readonly found: true; readonly account: Account | null } | { readonly found: false };

@Injectable()
export class OpenShareLinkUseCase {
  constructor(
    @Inject(SHARE_LINK_REPOSITORY) private readonly links: ShareLinkRepository,
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(GOAL_REPOSITORY) private readonly goals: GoalRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(token: string): Promise<SharedProject> {
    const link = isShareToken(token) ? await this.links.findByTokenHash(sha256Hex(token)) : null;
    if (link === null || !isShareLinkOpen(link, this.clock.now())) {
      throw new ShareLinkNotFoundError();
    }
    const [project, owner] = await Promise.all([
      this.projects.findById(link.projectId),
      this.accountOf(link.projectId),
    ]);
    if (project === null || !owner.found || !mayShare(owner.account)) {
      throw new ShareLinkNotFoundError();
    }
    return { link, project, goals: await this.goals.listByProject(project.id) };
  }

  private async accountOf(projectId: string): Promise<AccountLookup> {
    const accountId = await this.projects.accountIdOf(projectId);
    if (accountId === null) {
      return { found: true, account: null };
    }
    const account = await this.accounts.findById(accountId);
    return account === null ? { found: false } : { found: true, account };
  }
}

function mayShare(account: Account | null): boolean {
  return mayUseProFeatures(account) && (account === null || !isSuspended(account));
}

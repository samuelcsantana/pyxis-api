import { Inject, Injectable } from '@nestjs/common';
import { planLimitsOf } from '../../domain/accounts/account-limits';
import { AccountNotFoundError, ProjectLimitReachedError } from '../../domain/errors/account.errors';
import { generatePublicKey } from '../../domain/keys/project-keys';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import {
  DEFAULT_TIMEZONE,
  requireConversionEvent,
  requireOrigins,
  requireProjectName,
  requireTimeZone,
} from '../../domain/projects/project-settings';
import {
  type CreatedProject,
  type NewProject,
  PROJECT_SETTINGS_REPOSITORY,
  type ProjectSettingsRepository,
} from '../../domain/repositories/project-settings.repository';
import { RANDOM_SOURCE, type RandomSource } from '../../domain/services/random-source';

export interface CreateProjectCommand {
  readonly name: string;
  readonly allowedOrigins: readonly string[];
  readonly timezone?: string;
  readonly conversionEvent?: string;
  readonly accountId?: string;
}

export interface CreateProjectResult {
  readonly projectId: string;
  readonly publicKeyId: string;
  readonly publicKey: string;
}

@Injectable()
export class CreateProjectUseCase {
  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
  ) {}

  async execute(command: CreateProjectCommand): Promise<CreateProjectResult> {
    const settings = {
      name: requireProjectName(command.name),
      allowedOrigins: requireOrigins(command.allowedOrigins),
      timezone: requireTimeZone(command.timezone ?? DEFAULT_TIMEZONE),
      conversionEvent:
        command.conversionEvent === undefined
          ? null
          : requireConversionEvent(command.conversionEvent),
    };
    const publicKey = generatePublicKey(this.random);
    const created =
      command.accountId === undefined
        ? await this.projects.createWithPublicKey(settings, publicKey)
        : await this.createInAccount(settings, publicKey, command.accountId);
    return { projectId: created.project.id, publicKeyId: created.publicKeyId, publicKey };
  }

  private async createInAccount(
    settings: NewProject,
    publicKey: string,
    accountId: string,
  ): Promise<CreatedProject> {
    const account = await this.accounts.findById(accountId);
    if (account === null) {
      throw new AccountNotFoundError();
    }
    const maxProjects = planLimitsOf(account).projects;
    const result = await this.projects.createWithPublicKeyInAccount(settings, publicKey, {
      accountId,
      maxProjects,
    });
    switch (result.outcome) {
      case 'created':
        return result.created;
      case 'account_not_found':
        throw new AccountNotFoundError();
      case 'project_limit_reached':
        throw new ProjectLimitReachedError(maxProjects);
    }
  }
}

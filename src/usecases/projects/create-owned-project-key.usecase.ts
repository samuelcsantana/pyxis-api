import { Inject, Injectable } from '@nestjs/common';
import { KeyLimitReachedError } from '../../domain/errors/project.errors';
import { MAX_LIVE_KEYS_PER_KIND } from '../../domain/keys/project-keys';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import {
  PROJECT_KEY_REPOSITORY,
  type ProjectKeyRepository,
} from '../../domain/repositories/project-key.repository';
import {
  PROJECT_SETTINGS_REPOSITORY,
  type ProjectSettingsRepository,
} from '../../domain/repositories/project-settings.repository';
import {
  type CreateProjectKeyCommand,
  type CreateProjectKeyResult,
  CreateProjectKeyUseCase,
} from './create-project-key.usecase';
import { changeableProject } from './owned-project';

export interface CreateOwnedProjectKeyCommand extends CreateProjectKeyCommand {
  readonly adminUserId: string;
}

@Injectable()
export class CreateOwnedProjectKeyUseCase {
  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(PROJECT_KEY_REPOSITORY) private readonly keys: ProjectKeyRepository,
    private readonly createKey: CreateProjectKeyUseCase,
  ) {}

  async execute(command: CreateOwnedProjectKeyCommand): Promise<CreateProjectKeyResult> {
    const { adminUserId, ...key } = command;
    await changeableProject(this.projects, this.accounts, key.projectId, adminUserId);
    const live = await this.keys.liveKeysOf(key.projectId);
    if (live.filter(({ kind }) => kind === key.kind).length >= MAX_LIVE_KEYS_PER_KIND) {
      throw new KeyLimitReachedError(MAX_LIVE_KEYS_PER_KIND);
    }
    return this.createKey.execute(key);
  }
}

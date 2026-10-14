import { Inject, Injectable } from '@nestjs/common';
import { LastPublicKeyError, ProjectKeyNotFoundError } from '../../domain/errors/project.errors';
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
import { CLOCK, type Clock } from '../../domain/services/clock';
import { changeableProject } from './owned-project';

export interface RevokeOwnedProjectKeyCommand {
  readonly adminUserId: string;
  readonly projectId: string;
  readonly keyId: string;
}

@Injectable()
export class RevokeOwnedProjectKeyUseCase {
  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(PROJECT_KEY_REPOSITORY) private readonly keys: ProjectKeyRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: RevokeOwnedProjectKeyCommand): Promise<void> {
    await changeableProject(this.projects, this.accounts, command.projectId, command.adminUserId);
    const live = await this.keys.liveKeysOf(command.projectId);
    const key = live.find(({ id }) => id === command.keyId);
    if (key === undefined) {
      throw new ProjectKeyNotFoundError();
    }
    if (key.kind === 'public' && live.filter(({ kind }) => kind === 'public').length === 1) {
      throw new LastPublicKeyError();
    }
    if (!(await this.keys.revoke(key.id, this.clock.now()))) {
      throw new ProjectKeyNotFoundError();
    }
  }
}

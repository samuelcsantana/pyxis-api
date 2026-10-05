import { Inject, Injectable } from '@nestjs/common';
import { ProjectNotFoundError } from '../../domain/errors/project.errors';
import {
  generatePublicKey,
  generateSecretKey,
  hashSecretKey,
} from '../../domain/keys/project-keys';
import {
  type NewProjectKey,
  PROJECT_KEY_REPOSITORY,
  type ProjectKeyRepository,
} from '../../domain/repositories/project-key.repository';
import {
  PROJECT_SETTINGS_REPOSITORY,
  type ProjectSettingsRepository,
} from '../../domain/repositories/project-settings.repository';
import { RANDOM_SOURCE, type RandomSource } from '../../domain/services/random-source';

export interface CreateProjectKeyCommand {
  readonly projectId: string;
  readonly kind: 'public' | 'secret';
}

export interface CreateProjectKeyResult {
  readonly keyId: string;
  readonly kind: 'public' | 'secret';
  readonly key: string;
}

@Injectable()
export class CreateProjectKeyUseCase {
  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(PROJECT_KEY_REPOSITORY) private readonly keys: ProjectKeyRepository,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
  ) {}

  async execute(command: CreateProjectKeyCommand): Promise<CreateProjectKeyResult> {
    if ((await this.projects.findById(command.projectId)) === null) {
      throw new ProjectNotFoundError();
    }
    const { key, record } = this.newKey(command);
    const created = await this.keys.create(record);
    return { keyId: created.id, kind: command.kind, key };
  }

  private newKey(command: CreateProjectKeyCommand): { key: string; record: NewProjectKey } {
    if (command.kind === 'public') {
      const key = generatePublicKey(this.random);
      return { key, record: { projectId: command.projectId, kind: 'public', publicKey: key } };
    }
    const key = generateSecretKey(this.random);
    return {
      key,
      record: { projectId: command.projectId, kind: 'secret', secretHash: hashSecretKey(key) },
    };
  }
}

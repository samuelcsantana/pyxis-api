import { Inject, Injectable } from '@nestjs/common';
import { ProjectKeyNotFoundError } from '../../domain/errors/project.errors';
import {
  PROJECT_KEY_REPOSITORY,
  type ProjectKeyRepository,
} from '../../domain/repositories/project-key.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

@Injectable()
export class RevokeProjectKeyUseCase {
  constructor(
    @Inject(PROJECT_KEY_REPOSITORY) private readonly keys: ProjectKeyRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(keyId: string): Promise<void> {
    if (!(await this.keys.revoke(keyId, this.clock.now()))) {
      throw new ProjectKeyNotFoundError();
    }
  }
}

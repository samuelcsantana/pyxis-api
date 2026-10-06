import { timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { UnknownProjectKeyError } from '../../domain/errors/ingest.errors';
import { hashSecretKey, secretKeyFromAuthorization } from '../../domain/keys/project-keys';
import {
  type LiveSecretKey,
  PROJECT_KEY_REPOSITORY,
  type ProjectKeyRepository,
} from '../../domain/repositories/project-key.repository';

@Injectable()
export class AuthenticateSecretKeyUseCase {
  constructor(@Inject(PROJECT_KEY_REPOSITORY) private readonly keys: ProjectKeyRepository) {}

  async execute(authorization: string | undefined): Promise<LiveSecretKey> {
    const secretKey = secretKeyFromAuthorization(authorization);
    if (secretKey === null) {
      throw new UnknownProjectKeyError();
    }
    const hash = hashSecretKey(secretKey);
    const key = await this.keys.findLiveSecret(hash);
    if (key === null || !timingSafeEqual(Buffer.from(key.secretHash), Buffer.from(hash))) {
      throw new UnknownProjectKeyError();
    }
    return key;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { AccessTokenNotFoundError } from '../../domain/errors/auth.errors';
import {
  ACCESS_TOKEN_REPOSITORY,
  type AccessTokenRepository,
} from '../../domain/repositories/access-token.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

export interface OperatorTokenRevocation {
  readonly tokenId: string;
}

@Injectable()
export class RevokeAccessTokenAsOperatorUseCase {
  constructor(
    @Inject(ACCESS_TOKEN_REPOSITORY) private readonly tokens: AccessTokenRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: OperatorTokenRevocation): Promise<void> {
    if (!(await this.tokens.revoke(command.tokenId, this.clock.now()))) {
      throw new AccessTokenNotFoundError();
    }
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { ConnectionNotFoundError } from '../../domain/errors/oauth.errors';
import {
  OAUTH_CONNECTION_REPOSITORY,
  type OAuthConnectionRepository,
} from '../../domain/repositories/oauth-connection.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

export interface OperatorConnectionRevocation {
  readonly connectionId: string;
}

@Injectable()
export class RevokeConnectionAsOperatorUseCase {
  constructor(
    @Inject(OAUTH_CONNECTION_REPOSITORY) private readonly connections: OAuthConnectionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: OperatorConnectionRevocation): Promise<void> {
    if (!(await this.connections.revoke(command.connectionId, this.clock.now()))) {
      throw new ConnectionNotFoundError();
    }
  }
}

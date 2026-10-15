import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import { ConnectionNotFoundError } from '../../domain/errors/oauth.errors';
import {
  OAUTH_CONNECTION_REPOSITORY,
  type OAuthConnectionRepository,
} from '../../domain/repositories/oauth-connection.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

@Injectable()
export class RevokeConnectionUseCase {
  private readonly logger = new Logger(RevokeConnectionUseCase.name);

  constructor(
    @Inject(OAUTH_CONNECTION_REPOSITORY) private readonly connections: OAuthConnectionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(admin: AdminUser, connectionId: string): Promise<void> {
    if (!(await this.connections.revokeOneOf(admin.id, connectionId, this.clock.now()))) {
      throw new ConnectionNotFoundError();
    }
    this.logger.log({
      message: 'oauth.connection_revoked',
      connectionId,
      adminUserId: admin.id,
      by: 'admin',
    });
  }
}

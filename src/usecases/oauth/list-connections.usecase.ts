import { Inject, Injectable } from '@nestjs/common';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import type { OAuthConnection } from '../../domain/entities/oauth-connection.entity';
import { idleConnectionCutoff } from '../../domain/oauth/oauth-policy';
import {
  OAUTH_CONNECTION_REPOSITORY,
  type OAuthConnectionRepository,
} from '../../domain/repositories/oauth-connection.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

@Injectable()
export class ListConnectionsUseCase {
  constructor(
    @Inject(OAUTH_CONNECTION_REPOSITORY) private readonly connections: OAuthConnectionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  execute(admin: AdminUser): Promise<readonly OAuthConnection[]> {
    return this.connections.listLiveOf(admin.id, idleConnectionCutoff(this.clock.now()));
  }
}

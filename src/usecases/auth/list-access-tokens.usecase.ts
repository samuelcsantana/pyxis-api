import { Inject, Injectable } from '@nestjs/common';
import type { AccessToken } from '../../domain/entities/access-token.entity';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import {
  ACCESS_TOKEN_REPOSITORY,
  type AccessTokenRepository,
} from '../../domain/repositories/access-token.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

@Injectable()
export class ListAccessTokensUseCase {
  constructor(
    @Inject(ACCESS_TOKEN_REPOSITORY) private readonly tokens: AccessTokenRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  execute(admin: AdminUser): Promise<readonly AccessToken[]> {
    return this.tokens.listLiveOf(admin.id, this.clock.now());
  }
}

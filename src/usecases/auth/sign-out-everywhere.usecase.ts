import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import {
  ADMIN_SESSION_REPOSITORY,
  type AdminSessionRepository,
} from '../../domain/repositories/admin-session.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

@Injectable()
export class SignOutEverywhereUseCase {
  private readonly logger = new Logger(SignOutEverywhereUseCase.name);

  constructor(
    @Inject(ADMIN_SESSION_REPOSITORY) private readonly sessions: AdminSessionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(admin: AdminUser): Promise<number> {
    const revoked = await this.sessions.revokeAllOf(admin.id, this.clock.now());
    this.logger.log({ message: 'auth.signed_out_everywhere', adminUserId: admin.id, revoked });
    return revoked;
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import { SessionNotFoundError } from '../../domain/errors/auth.errors';
import {
  ADMIN_SESSION_REPOSITORY,
  type AdminSessionRepository,
} from '../../domain/repositories/admin-session.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

@Injectable()
export class EndSessionUseCase {
  private readonly logger = new Logger(EndSessionUseCase.name);

  constructor(
    @Inject(ADMIN_SESSION_REPOSITORY) private readonly sessions: AdminSessionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(admin: AdminUser, sessionId: string): Promise<void> {
    const ended = await this.sessions.revokeOneOf(admin.id, sessionId, this.clock.now());
    if (!ended) {
      throw new SessionNotFoundError();
    }
    this.logger.log({ message: 'auth.session_ended', adminUserId: admin.id });
  }
}

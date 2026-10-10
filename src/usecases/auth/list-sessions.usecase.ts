import { Inject, Injectable } from '@nestjs/common';
import { isSessionActive } from '../../domain/auth/session-policy';
import type { AdminSession } from '../../domain/entities/admin-session.entity';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import {
  ADMIN_SESSION_REPOSITORY,
  type AdminSessionRepository,
} from '../../domain/repositories/admin-session.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

export interface ListedSession extends AdminSession {
  readonly current: boolean;
}

@Injectable()
export class ListSessionsUseCase {
  constructor(
    @Inject(ADMIN_SESSION_REPOSITORY) private readonly sessions: AdminSessionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(admin: AdminUser, currentSession: AdminSession): Promise<readonly ListedSession[]> {
    const now = this.clock.now();
    const live = await this.sessions.listLiveOf(admin.id);
    return live
      .filter((session) => isSessionActive(session, now))
      .map((session) => ({ ...session, current: session.id === currentSession.id }));
  }
}

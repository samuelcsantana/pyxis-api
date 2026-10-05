import { Inject, Injectable } from '@nestjs/common';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import { sha256Hex } from '../../domain/auth/hashing';
import { isSessionActive, needsTouch } from '../../domain/auth/session-policy';
import { UnauthenticatedError } from '../../domain/errors/auth.errors';
import {
  ADMIN_SESSION_REPOSITORY,
  type AdminSessionRepository,
} from '../../domain/repositories/admin-session.repository';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../domain/repositories/admin-user.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

@Injectable()
export class AuthenticateSessionUseCase {
  constructor(
    @Inject(ADMIN_SESSION_REPOSITORY) private readonly sessions: AdminSessionRepository,
    @Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(sessionToken: string | undefined): Promise<AdminUser> {
    if (sessionToken === undefined) {
      throw new UnauthenticatedError();
    }
    const session = await this.sessions.findLiveByTokenHash(sha256Hex(sessionToken));
    const now = this.clock.now();
    if (session === null || !isSessionActive(session, now)) {
      throw new UnauthenticatedError();
    }
    if (needsTouch(session, now)) {
      await this.sessions.touch(session.id, now);
    }
    const admin = await this.admins.findById(session.adminUserId);
    if (admin === null) {
      throw new UnauthenticatedError();
    }
    return admin;
  }
}

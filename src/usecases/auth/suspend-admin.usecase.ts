import { Inject, Injectable } from '@nestjs/common';
import { normalizeEmail } from '../../domain/auth/email';
import { AdminNotFoundError } from '../../domain/errors/auth.errors';
import {
  ACCESS_TOKEN_REPOSITORY,
  type AccessTokenRepository,
} from '../../domain/repositories/access-token.repository';
import {
  ADMIN_SESSION_REPOSITORY,
  type AdminSessionRepository,
} from '../../domain/repositories/admin-session.repository';
import {
  ADMIN_SUSPENSION_REPOSITORY,
  type AdminSuspensionRepository,
} from '../../domain/repositories/admin-suspension.repository';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../domain/repositories/admin-user.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

export interface AdminByEmailCommand {
  readonly email: string;
}

export interface SuspendedAdmin {
  readonly adminUserId: string;
  readonly email: string;
  readonly suspendedAt: Date;
  readonly sessionsEnded: number;
  readonly tokensRevoked: number;
}

@Injectable()
export class SuspendAdminUseCase {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository,
    @Inject(ADMIN_SUSPENSION_REPOSITORY) private readonly suspensions: AdminSuspensionRepository,
    @Inject(ADMIN_SESSION_REPOSITORY) private readonly sessions: AdminSessionRepository,
    @Inject(ACCESS_TOKEN_REPOSITORY) private readonly tokens: AccessTokenRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: AdminByEmailCommand): Promise<SuspendedAdmin> {
    const admin = await this.admins.findByEmail(normalizeEmail(command.email));
    if (admin === null) {
      throw new AdminNotFoundError();
    }
    const now = this.clock.now();
    const suspendedAt = admin.suspendedAt ?? now;
    if ((await this.suspensions.suspend(admin.id, suspendedAt)) === null) {
      throw new AdminNotFoundError();
    }
    return {
      adminUserId: admin.id,
      email: admin.email,
      suspendedAt,
      sessionsEnded: await this.sessions.revokeAllOf(admin.id, now),
      tokensRevoked: await this.tokens.revokeAllOf(admin.id, now),
    };
  }
}

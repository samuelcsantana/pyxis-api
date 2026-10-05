import { Inject, Injectable } from '@nestjs/common';
import { sha256Hex } from '../../domain/auth/hashing';
import {
  ADMIN_SESSION_REPOSITORY,
  type AdminSessionRepository,
} from '../../domain/repositories/admin-session.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

@Injectable()
export class SignOutUseCase {
  constructor(
    @Inject(ADMIN_SESSION_REPOSITORY) private readonly sessions: AdminSessionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(sessionToken: string | undefined): Promise<void> {
    if (sessionToken === undefined) {
      return;
    }
    const session = await this.sessions.findLiveByTokenHash(sha256Hex(sessionToken));
    if (session !== null) {
      await this.sessions.revoke(session.id, this.clock.now());
    }
  }
}

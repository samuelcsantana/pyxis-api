import { Inject, Injectable, Logger } from '@nestjs/common';
import { sha256Hex } from '../../domain/auth/hashing';
import {
  ShareLinkLockedError,
  SharePasswordNotSetError,
  WrongSharePasswordError,
} from '../../domain/errors/share-link.errors';
import {
  SHARE_LINK_REPOSITORY,
  SHARE_UNLOCK_REPOSITORY,
  type ShareLinkRepository,
  type ShareUnlockRepository,
} from '../../domain/repositories/share-link.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { PASSWORD_HASHER, type PasswordHasher } from '../../domain/services/password-hasher';
import { RANDOM_SOURCE, type RandomSource } from '../../domain/services/random-source';
import {
  generateShareUnlock,
  secondsUntilUnlockable,
  shareUnlockExpiry,
  UNLOCK_FAILURE_WINDOW_MS,
} from '../../domain/share-links/share-unlock';
import { OpenShareLinkUseCase } from './open-share-link.usecase';

export interface ShareUnlock {
  readonly unlock: string;
  readonly expiresAt: Date;
}

@Injectable()
export class UnlockShareLinkUseCase {
  private readonly logger = new Logger(UnlockShareLinkUseCase.name);

  constructor(
    private readonly openShareLink: OpenShareLinkUseCase,
    @Inject(SHARE_LINK_REPOSITORY) private readonly links: ShareLinkRepository,
    @Inject(SHARE_UNLOCK_REPOSITORY) private readonly unlocks: ShareUnlockRepository,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasher,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(token: string, password: string): Promise<ShareUnlock> {
    const { link } = await this.openShareLink.execute(token);
    const now = this.clock.now();
    const [passwordHash, failures] = await Promise.all([
      this.links.passwordHashOf(link.id),
      this.links.unlockFailuresOf(link.id),
    ]);
    if (passwordHash === null) {
      throw new SharePasswordNotSetError();
    }
    const waitSeconds = secondsUntilUnlockable(failures, now);
    if (waitSeconds !== null) {
      throw new ShareLinkLockedError(waitSeconds);
    }
    if (!(await this.passwords.verify(password, passwordHash))) {
      await this.links.recordUnlockFailure(link.id, now, UNLOCK_FAILURE_WINDOW_MS);
      this.logger.warn({ message: 'share_link.unlock_failed', shareLinkId: link.id });
      throw new WrongSharePasswordError();
    }
    const unlock = generateShareUnlock(this.random);
    const expiresAt = shareUnlockExpiry(now);
    await this.unlocks.issue(link.id, sha256Hex(unlock), now, expiresAt);
    this.logger.log({ message: 'share_link.unlocked', shareLinkId: link.id });
    return { unlock, expiresAt };
  }
}

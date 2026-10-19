import { Inject, Injectable } from '@nestjs/common';
import { normalizeEmail } from '../../domain/auth/email';
import { sha256Hex } from '../../domain/auth/hashing';
import { reviewerCodeExpiry } from '../../domain/auth/reviewer-code';
import { generateSignInCode } from '../../domain/auth/sign-in-code';
import { AdminNotFoundError } from '../../domain/errors/auth.errors';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../domain/repositories/admin-user.repository';
import {
  REVIEWER_CODE_REPOSITORY,
  type ReviewerCodeRepository,
} from '../../domain/repositories/reviewer-code.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { RANDOM_SOURCE, type RandomSource } from '../../domain/services/random-source';

export interface OpenReviewerCodeCommand {
  readonly email: string;
  readonly days: number;
}

export interface OpenedReviewerCode {
  readonly adminUserId: string;
  readonly email: string;
  readonly code: string;
  readonly expiresAt: Date;
}

@Injectable()
export class OpenReviewerCodeUseCase {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository,
    @Inject(REVIEWER_CODE_REPOSITORY) private readonly codes: ReviewerCodeRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
  ) {}

  async execute(command: OpenReviewerCodeCommand): Promise<OpenedReviewerCode> {
    const admin = await this.admins.findByEmail(normalizeEmail(command.email));
    if (admin === null) {
      throw new AdminNotFoundError();
    }
    const now = this.clock.now();
    const code = generateSignInCode(this.random);
    const opened = await this.codes.open({
      adminUserId: admin.id,
      codeHash: sha256Hex(code),
      createdAt: now,
      expiresAt: reviewerCodeExpiry(now, command.days),
    });
    return { adminUserId: admin.id, email: admin.email, code, expiresAt: opened.expiresAt };
  }
}

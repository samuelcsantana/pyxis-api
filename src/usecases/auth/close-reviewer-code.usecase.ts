import { Inject, Injectable } from '@nestjs/common';
import { normalizeEmail } from '../../domain/auth/email';
import { AdminNotFoundError } from '../../domain/errors/auth.errors';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../domain/repositories/admin-user.repository';
import {
  REVIEWER_CODE_REPOSITORY,
  type ReviewerCodeRepository,
} from '../../domain/repositories/reviewer-code.repository';

export interface CloseReviewerCodeCommand {
  readonly email: string;
}

export interface ClosedReviewerCode {
  readonly adminUserId: string;
  readonly email: string;
  readonly closed: boolean;
}

@Injectable()
export class CloseReviewerCodeUseCase {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository,
    @Inject(REVIEWER_CODE_REPOSITORY) private readonly codes: ReviewerCodeRepository,
  ) {}

  async execute(command: CloseReviewerCodeCommand): Promise<ClosedReviewerCode> {
    const admin = await this.admins.findByEmail(normalizeEmail(command.email));
    if (admin === null) {
      throw new AdminNotFoundError();
    }
    return { adminUserId: admin.id, email: admin.email, closed: await this.codes.close(admin.id) };
  }
}

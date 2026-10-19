import type { Logger } from '@nestjs/common';
import { equalHashes, sha256Hex } from '../../domain/auth/hashing';
import { MAX_REVIEWER_CODE_FAILURES } from '../../domain/auth/reviewer-code';
import { InvalidSignInCodeError } from '../../domain/errors/auth.errors';
import type { ReviewerCodeRepository } from '../../domain/repositories/reviewer-code.repository';

export interface ReviewerCodeAttempt {
  readonly adminUserId: string;
  readonly code: string;
  readonly now: Date;
}

export async function consumeReviewerCode(
  codes: ReviewerCodeRepository,
  attempt: ReviewerCodeAttempt,
  logger: Logger,
): Promise<void> {
  const reserved = await codes.reserveAttempt(
    attempt.adminUserId,
    attempt.now,
    MAX_REVIEWER_CODE_FAILURES,
  );
  if (reserved === null) {
    throw new InvalidSignInCodeError();
  }
  if (equalHashes(reserved.codeHash, sha256Hex(attempt.code))) {
    await codes.releaseAttempt(attempt.adminUserId);
    return;
  }
  logger.warn({ message: 'auth.invalid_code_attempt', purpose: 'reviewer' });
  if (reserved.failedAttempts >= MAX_REVIEWER_CODE_FAILURES) {
    await codes.close(attempt.adminUserId);
    logger.warn({ message: 'auth.reviewer_code_locked', adminUserId: attempt.adminUserId });
  }
  throw new InvalidSignInCodeError();
}

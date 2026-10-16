import type { Logger } from '@nestjs/common';
import type { CodePurpose } from '../../domain/auth/code-purpose';
import { equalHashes, sha256Hex } from '../../domain/auth/hashing';
import { MAX_SIGN_IN_CODE_ATTEMPTS } from '../../domain/auth/sign-in-code';
import type { OtpCode } from '../../domain/entities/otp-code.entity';
import { InvalidSignInCodeError } from '../../domain/errors/auth.errors';
import type { OtpCodeRepository } from '../../domain/repositories/otp-code.repository';

export interface CodeAttempt {
  readonly email: string;
  readonly code: string;
  readonly purpose: CodePurpose;
  readonly now: Date;
}

export async function consumeCode(
  codes: OtpCodeRepository,
  attempt: CodeAttempt,
  logger: Logger,
): Promise<OtpCode> {
  const latest = await codes.findLatestValid(attempt.email, attempt.now, attempt.purpose);
  if (latest === null) {
    throw new InvalidSignInCodeError();
  }
  const withinLimit = await codes.consumeAttempt(latest.id, MAX_SIGN_IN_CODE_ATTEMPTS);
  if (!withinLimit || !equalHashes(latest.codeHash, sha256Hex(attempt.code))) {
    logger.warn({ message: 'auth.invalid_code_attempt', purpose: attempt.purpose });
    throw new InvalidSignInCodeError();
  }
  if (!(await codes.claim(latest.id, attempt.now))) {
    throw new InvalidSignInCodeError();
  }
  return latest;
}

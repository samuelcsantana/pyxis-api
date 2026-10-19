import type { ReviewerCode } from '../entities/reviewer-code.entity';

export interface NewReviewerCode {
  readonly adminUserId: string;
  readonly codeHash: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface ReviewerCodeRepository {
  open(code: NewReviewerCode): Promise<ReviewerCode>;
  findLive(adminUserId: string, now: Date): Promise<ReviewerCode | null>;
  reserveAttempt(adminUserId: string, now: Date, maxFailures: number): Promise<ReviewerCode | null>;
  releaseAttempt(adminUserId: string): Promise<void>;
  close(adminUserId: string): Promise<boolean>;
}

export const REVIEWER_CODE_REPOSITORY = Symbol('ReviewerCodeRepository');

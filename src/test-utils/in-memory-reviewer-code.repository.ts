import type { ReviewerCode } from '../domain/entities/reviewer-code.entity';
import type {
  NewReviewerCode,
  ReviewerCodeRepository,
} from '../domain/repositories/reviewer-code.repository';

export class InMemoryReviewerCodeRepository implements ReviewerCodeRepository {
  readonly stored = new Map<string, ReviewerCode>();

  open(code: NewReviewerCode): Promise<ReviewerCode> {
    const opened: ReviewerCode = { ...code, failedAttempts: 0 };
    this.stored.set(code.adminUserId, opened);
    return Promise.resolve(opened);
  }

  findLive(adminUserId: string, now: Date): Promise<ReviewerCode | null> {
    const code = this.stored.get(adminUserId);
    return Promise.resolve(code !== undefined && code.expiresAt > now ? code : null);
  }

  reserveAttempt(
    adminUserId: string,
    now: Date,
    maxFailures: number,
  ): Promise<ReviewerCode | null> {
    const code = this.stored.get(adminUserId);
    if (code === undefined || code.expiresAt <= now || code.failedAttempts >= maxFailures) {
      return Promise.resolve(null);
    }
    const reserved: ReviewerCode = { ...code, failedAttempts: code.failedAttempts + 1 };
    this.stored.set(adminUserId, reserved);
    return Promise.resolve(reserved);
  }

  releaseAttempt(adminUserId: string): Promise<void> {
    const code = this.stored.get(adminUserId);
    if (code !== undefined && code.failedAttempts > 0) {
      this.stored.set(adminUserId, { ...code, failedAttempts: code.failedAttempts - 1 });
    }
    return Promise.resolve();
  }

  close(adminUserId: string): Promise<boolean> {
    return Promise.resolve(this.stored.delete(adminUserId));
  }
}

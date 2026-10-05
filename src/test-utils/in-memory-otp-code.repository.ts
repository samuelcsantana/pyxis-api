import type { OtpCode } from '../domain/entities/otp-code.entity';
import type { NewOtpCode, OtpCodeRepository } from '../domain/repositories/otp-code.repository';

interface StoredCode extends OtpCode {
  readonly createdAt: Date;
  attempts: number;
  usedAt: Date | null;
}

export class InMemoryOtpCodeRepository implements OtpCodeRepository {
  readonly stored: StoredCode[] = [];

  create(code: NewOtpCode): Promise<OtpCode> {
    const created: StoredCode = {
      ...code,
      id: `00000000-0000-4000-b000-${String(this.stored.length + 1).padStart(12, '0')}`,
      attempts: 0,
      usedAt: null,
    };
    this.stored.push(created);
    return Promise.resolve(created);
  }

  countCreatedSince(email: string, since: Date): Promise<number> {
    return Promise.resolve(
      this.stored.filter((code) => code.email === email && code.createdAt >= since).length,
    );
  }

  findLatestValid(email: string, now: Date): Promise<OtpCode | null> {
    const valid = this.stored.filter(
      (code) => code.email === email && code.usedAt === null && code.expiresAt > now,
    );
    return Promise.resolve(valid.at(-1) ?? null);
  }

  consumeAttempt(codeId: string, maxAttempts: number): Promise<boolean> {
    const code = this.stored.find(
      (candidate) => candidate.id === codeId && candidate.attempts < maxAttempts,
    );
    if (code === undefined) {
      return Promise.resolve(false);
    }
    code.attempts += 1;
    return Promise.resolve(true);
  }

  markUsed(codeId: string, usedAt: Date): Promise<void> {
    for (const code of this.stored.filter((candidate) => candidate.id === codeId)) {
      code.usedAt = usedAt;
    }
    return Promise.resolve();
  }
}

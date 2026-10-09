import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, gte, isNull, lt, sql } from 'drizzle-orm';
import type { OtpCode } from '../../domain/entities/otp-code.entity';
import type { NewOtpCode, OtpCodeRepository } from '../../domain/repositories/otp-code.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { insertedRow } from '../database/inserted-row';
import { otpCodes } from '../database/schema/admins';

type OtpCodeRow = typeof otpCodes.$inferSelect;

function toOtpCode(row: OtpCodeRow): OtpCode {
  return {
    id: row.id,
    email: row.email,
    codeHash: row.codeHash,
    emailLanguage: row.emailLanguage,
    expiresAt: row.expiresAt,
  };
}

@Injectable()
export class DrizzleOtpCodeRepository implements OtpCodeRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async create(code: NewOtpCode): Promise<OtpCode> {
    return toOtpCode(insertedRow(await this.db.insert(otpCodes).values(code).returning()));
  }

  countCreatedSince(email: string, since: Date): Promise<number> {
    return this.db.$count(otpCodes, and(eq(otpCodes.email, email), gte(otpCodes.createdAt, since)));
  }

  async findLatestValid(email: string, now: Date): Promise<OtpCode | null> {
    const [row] = await this.db
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.email, email), isNull(otpCodes.usedAt), gt(otpCodes.expiresAt, now)))
      .orderBy(desc(otpCodes.createdAt))
      .limit(1);
    return row === undefined ? null : toOtpCode(row);
  }

  async consumeAttempt(codeId: string, maxAttempts: number): Promise<boolean> {
    const counted = await this.db
      .update(otpCodes)
      .set({ attempts: sql`${otpCodes.attempts} + 1` })
      .where(and(eq(otpCodes.id, codeId), lt(otpCodes.attempts, maxAttempts)))
      .returning({ id: otpCodes.id });
    return counted.length > 0;
  }

  async claim(codeId: string, usedAt: Date): Promise<boolean> {
    const claimed = await this.db
      .update(otpCodes)
      .set({ usedAt })
      .where(and(eq(otpCodes.id, codeId), isNull(otpCodes.usedAt)))
      .returning({ id: otpCodes.id });
    return claimed.length > 0;
  }
}

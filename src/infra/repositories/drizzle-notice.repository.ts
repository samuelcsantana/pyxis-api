import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { AccountStatus } from '../../domain/accounts/account-status';
import type { EmailLanguage } from '../../domain/auth/email-language';
import type {
  CreatedNotice,
  NewNotice,
  NoticeRepository,
  PendingNoticeDelivery,
} from '../../domain/repositories/notice.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { accounts } from '../database/schema/accounts';
import { adminUsers } from '../database/schema/admins';
import { noticeDeliveries, notices } from '../database/schema/notices';

@Injectable()
export class DrizzleNoticeRepository implements NoticeRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async audienceLanguages(audience: readonly AccountStatus[]): Promise<readonly EmailLanguage[]> {
    const rows = await this.db
      .select({ language: adminUsers.emailLanguage })
      .from(accounts)
      .innerJoin(adminUsers, eq(adminUsers.id, accounts.ownerAdminId))
      .where(inArray(accounts.status, [...audience]));
    return rows.map((row) => row.language);
  }

  create(notice: NewNotice): Promise<CreatedNotice | null> {
    return this.db.transaction(async (transaction) => {
      const [created] = await transaction
        .insert(notices)
        .values({ campaign: notice.campaign, content: notice.content, createdAt: notice.createdAt })
        .onConflictDoNothing({ target: notices.campaign })
        .returning({ id: notices.id });
      if (created === undefined) {
        return null;
      }
      const recipients = await transaction
        .select({ accountId: accounts.id, language: adminUsers.emailLanguage })
        .from(accounts)
        .innerJoin(adminUsers, eq(adminUsers.id, accounts.ownerAdminId))
        .where(inArray(accounts.status, [...notice.audience]));
      if (recipients.length > 0) {
        await transaction.insert(noticeDeliveries).values(
          recipients.map((recipient) => ({
            noticeId: created.id,
            accountId: recipient.accountId,
            createdAt: notice.createdAt,
          })),
        );
      }
      return {
        noticeId: created.id,
        languages: recipients.map((recipient) => recipient.language),
      };
    });
  }

  async pending(limit: number): Promise<readonly PendingNoticeDelivery[]> {
    const rows = await this.db
      .select({
        noticeId: noticeDeliveries.noticeId,
        accountId: noticeDeliveries.accountId,
        campaign: notices.campaign,
        ownerEmail: adminUsers.email,
        ownerLanguage: adminUsers.emailLanguage,
        content: notices.content,
      })
      .from(noticeDeliveries)
      .innerJoin(notices, eq(notices.id, noticeDeliveries.noticeId))
      .innerJoin(accounts, eq(accounts.id, noticeDeliveries.accountId))
      .innerJoin(adminUsers, eq(adminUsers.id, accounts.ownerAdminId))
      .where(isNull(noticeDeliveries.sentAt))
      .orderBy(asc(noticeDeliveries.createdAt), asc(noticeDeliveries.accountId))
      .limit(limit);
    return rows;
  }

  async markSent(noticeId: string, accountId: string, at: Date): Promise<void> {
    await this.db
      .update(noticeDeliveries)
      .set({ sentAt: at })
      .where(
        and(eq(noticeDeliveries.noticeId, noticeId), eq(noticeDeliveries.accountId, accountId)),
      );
  }
}

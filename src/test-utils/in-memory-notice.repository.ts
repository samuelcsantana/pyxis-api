import type { AccountStatus } from '../domain/accounts/account-status';
import type { EmailLanguage } from '../domain/auth/email-language';
import type {
  CreatedNotice,
  NewNotice,
  NoticeRepository,
  PendingNoticeDelivery,
} from '../domain/repositories/notice.repository';

export interface NoticeRecipient {
  readonly accountId: string;
  readonly status: AccountStatus;
  readonly ownerEmail: string;
  readonly ownerLanguage: EmailLanguage;
}

interface StoredDelivery extends PendingNoticeDelivery {
  readonly sentAt: Date | null;
}

export class InMemoryNoticeRepository implements NoticeRepository {
  private readonly recipients: NoticeRecipient[] = [];
  private readonly campaigns: string[] = [];
  private deliveries: StoredDelivery[] = [];

  addRecipient(recipient: NoticeRecipient): void {
    this.recipients.push(recipient);
  }

  sentAt(noticeId: string, accountId: string): Date | null | undefined {
    return this.deliveries.find(
      (delivery) => delivery.noticeId === noticeId && delivery.accountId === accountId,
    )?.sentAt;
  }

  audienceLanguages(audience: readonly AccountStatus[]): Promise<readonly EmailLanguage[]> {
    return Promise.resolve(this.inAudience(audience).map((recipient) => recipient.ownerLanguage));
  }

  create(notice: NewNotice): Promise<CreatedNotice | null> {
    if (this.campaigns.includes(notice.campaign)) {
      return Promise.resolve(null);
    }
    this.campaigns.push(notice.campaign);
    const noticeId = `notice-${String(this.campaigns.length)}`;
    const recipients = this.inAudience(notice.audience);
    this.deliveries = [
      ...this.deliveries,
      ...recipients.map((recipient) => ({
        noticeId,
        accountId: recipient.accountId,
        campaign: notice.campaign,
        ownerEmail: recipient.ownerEmail,
        ownerLanguage: recipient.ownerLanguage,
        content: notice.content,
        sentAt: null,
      })),
    ];
    return Promise.resolve({
      noticeId,
      languages: recipients.map((recipient) => recipient.ownerLanguage),
    });
  }

  pending(limit: number): Promise<readonly PendingNoticeDelivery[]> {
    return Promise.resolve(
      this.deliveries
        .filter((delivery) => delivery.sentAt === null)
        .slice(0, limit)
        .map((delivery) => ({
          noticeId: delivery.noticeId,
          accountId: delivery.accountId,
          campaign: delivery.campaign,
          ownerEmail: delivery.ownerEmail,
          ownerLanguage: delivery.ownerLanguage,
          content: delivery.content,
        })),
    );
  }

  markSent(noticeId: string, accountId: string, at: Date): Promise<void> {
    this.deliveries = this.deliveries.map((delivery) =>
      delivery.noticeId === noticeId && delivery.accountId === accountId
        ? { ...delivery, sentAt: at }
        : delivery,
    );
    return Promise.resolve();
  }

  private inAudience(audience: readonly AccountStatus[]): readonly NoticeRecipient[] {
    return this.recipients.filter((recipient) => audience.includes(recipient.status));
  }
}

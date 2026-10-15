import type { AccountStatus } from '../accounts/account-status';
import type { EmailLanguage } from '../auth/email-language';
import type { NoticeContent } from '../notices/operator-notice';

export interface PendingNoticeDelivery {
  readonly noticeId: string;
  readonly accountId: string;
  readonly campaign: string;
  readonly ownerEmail: string;
  readonly ownerLanguage: EmailLanguage;
  readonly content: NoticeContent;
}

export interface NewNotice {
  readonly campaign: string;
  readonly content: NoticeContent;
  readonly audience: readonly AccountStatus[];
  readonly createdAt: Date;
}

export interface CreatedNotice {
  readonly noticeId: string;
  readonly languages: readonly EmailLanguage[];
}

export interface NoticeRepository {
  audienceLanguages(audience: readonly AccountStatus[]): Promise<readonly EmailLanguage[]>;
  create(notice: NewNotice): Promise<CreatedNotice | null>;
  pending(limit: number): Promise<readonly PendingNoticeDelivery[]>;
  markSent(noticeId: string, accountId: string, at: Date): Promise<void>;
}

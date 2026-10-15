import { Logger } from '@nestjs/common';
import { NOTICE_BATCH_SIZE } from '../../domain/notices/operator-notice';
import type {
  NoticeRepository,
  PendingNoticeDelivery,
} from '../../domain/repositories/notice.repository';
import type { Clock } from '../../domain/services/clock';
import type { MailSender } from '../../domain/services/mail-sender';

export interface OperatorNoticesReport {
  readonly sent: number;
  readonly failed: number;
}

export class SendOperatorNoticesUseCase {
  private readonly logger = new Logger(SendOperatorNoticesUseCase.name);

  constructor(
    private readonly notices: NoticeRepository,
    private readonly mail: MailSender,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<OperatorNoticesReport> {
    let sent = 0;
    let failed = 0;
    for (const delivery of await this.notices.pending(NOTICE_BATCH_SIZE)) {
      if (await this.tryDeliver(delivery)) {
        sent += 1;
      } else {
        failed += 1;
      }
    }
    const report = { sent, failed };
    this.logger.log({ message: 'notices.sent', ...report });
    return report;
  }

  private async tryDeliver(delivery: PendingNoticeDelivery): Promise<boolean> {
    try {
      await this.mail.sendOperatorNotice(
        delivery.ownerEmail,
        delivery.content[delivery.ownerLanguage],
        delivery.ownerLanguage,
      );
      await this.notices.markSent(delivery.noticeId, delivery.accountId, this.clock.now());
      return true;
    } catch (error) {
      this.logger.error({
        message: 'notices.delivery_failed',
        campaign: delivery.campaign,
        accountId: delivery.accountId,
        reason: String(error),
      });
      return false;
    }
  }
}

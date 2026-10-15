import { Logger } from '@nestjs/common';
import { type AccountMonthUsage, ingestionPauseFor } from '../../domain/accounts/account-quota';
import { type DueQuotaNotice, quotaNoticeDue } from '../../domain/accounts/quota-notice';
import { monthLabelOf, usageMonth } from '../../domain/queries/project-usage';
import type { AccountUsageRepository } from '../../domain/repositories/account-usage.repository';
import type { Clock } from '../../domain/services/clock';
import type { MailSender } from '../../domain/services/mail-sender';

export interface AccountUsageReport {
  readonly month: string;
  readonly accounts: number;
  readonly paused: number;
  readonly notified: number;
  readonly notificationsFailed: number;
}

export class MeasureAccountUsageUseCase {
  private readonly logger = new Logger(MeasureAccountUsageUseCase.name);

  constructor(
    private readonly usage: AccountUsageRepository,
    private readonly mail: MailSender,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<AccountUsageReport> {
    const now = this.clock.now();
    const month = monthLabelOf(now);
    const { from, to } = usageMonth(month);
    const measured = await this.usage.measure(month, from, to);
    const entries = measured.map((usage) => ({
      accountId: usage.accountId,
      events: usage.events,
      ingestionPausedUntil: ingestionPauseFor(usage, to, now),
    }));
    await this.usage.record(month, entries, now);
    let notified = 0;
    let notificationsFailed = 0;
    for (const usage of measured) {
      const due = quotaNoticeDue(usage, {
        notifiedLevel: usage.notifiedLevel,
        month,
        measuredAt: now,
        monthEnd: to,
      });
      if (due === null) {
        continue;
      }
      if (await this.tryNotify(usage, due, month)) {
        notified += 1;
      } else {
        notificationsFailed += 1;
      }
    }
    const report = {
      month,
      accounts: entries.length,
      paused: entries.filter((entry) => entry.ingestionPausedUntil !== null).length,
      notified,
      notificationsFailed,
    };
    this.logger.log({ message: 'account_usage.measured', ...report });
    return report;
  }

  private async tryNotify(
    usage: AccountMonthUsage,
    due: DueQuotaNotice,
    month: string,
  ): Promise<boolean> {
    try {
      await this.mail.sendQuotaNotice(usage.owner.email, due.notice, usage.owner.language);
      await this.usage.markNotified(usage.accountId, month, due.level);
      return true;
    } catch (error) {
      this.logger.error({
        message: 'account_usage.notice_failed',
        accountId: usage.accountId,
        kind: due.notice.kind,
        reason: String(error),
      });
      return false;
    }
  }
}

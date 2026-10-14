import { Logger } from '@nestjs/common';
import { ingestionPauseFor } from '../../domain/accounts/account-quota';
import { monthLabelOf, usageMonth } from '../../domain/queries/project-usage';
import type { AccountUsageRepository } from '../../domain/repositories/account-usage.repository';
import type { Clock } from '../../domain/services/clock';

export interface AccountUsageReport {
  readonly month: string;
  readonly accounts: number;
  readonly paused: number;
}

export class MeasureAccountUsageUseCase {
  private readonly logger = new Logger(MeasureAccountUsageUseCase.name);

  constructor(
    private readonly usage: AccountUsageRepository,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<AccountUsageReport> {
    const now = this.clock.now();
    const month = monthLabelOf(now);
    const { from, to } = usageMonth(month);
    const measured = await this.usage.measure(from, to);
    const entries = measured.map((usage) => ({
      accountId: usage.accountId,
      events: usage.events,
      ingestionPausedUntil: ingestionPauseFor(usage, to),
    }));
    await this.usage.record(month, entries, now);
    const report = {
      month,
      accounts: entries.length,
      paused: entries.filter((entry) => entry.ingestionPausedUntil !== null).length,
    };
    this.logger.log({ message: 'account_usage.measured', ...report });
    return report;
  }
}

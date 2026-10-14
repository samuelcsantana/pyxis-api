import { Inject, Injectable } from '@nestjs/common';
import {
  monthLabelOf,
  PROJECT_USAGE_QUERY,
  type ProjectUsage,
  type ProjectUsageQuery,
  usageMonth,
} from '../../domain/queries/project-usage';
import { CLOCK, type Clock } from '../../domain/services/clock';

export interface ReportProjectUsageCommand {
  readonly month?: string;
}

export interface UsageReport {
  readonly month: string;
  readonly projects: readonly ProjectUsage[];
}

@Injectable()
export class ReportProjectUsageUseCase {
  constructor(
    @Inject(PROJECT_USAGE_QUERY) private readonly usage: ProjectUsageQuery,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: ReportProjectUsageCommand): Promise<UsageReport> {
    const month = command.month ?? monthLabelOf(this.clock.now());
    const { from, to } = usageMonth(month);
    return { month, projects: await this.usage.usageBetween(from, to) };
  }
}

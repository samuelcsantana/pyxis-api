import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import {
  ACQUISITION_QUERY,
  type AcquisitionQuery,
  type AcquisitionReport,
  channelsPerDay,
  everyChannel,
  TOP_CAMPAIGNS,
  TOP_SOURCES,
  withConversionsWhenCounted,
} from '../../domain/queries/acquisition';
import { daysIn } from '../../domain/queries/date-range';
import { carriesRevenue } from '../../domain/queries/revenue';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { type RequestedRange, scopedPeriods } from './scoped-periods';

@Injectable()
export class GetAcquisitionUseCase {
  constructor(
    @Inject(ACQUISITION_QUERY) private readonly query: AcquisitionQuery,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(project: Project, requested: RequestedRange): Promise<AcquisitionReport> {
    const { current } = scopedPeriods(project, requested, this.clock.now());
    const [byDay, sources, campaigns, channels] = await Promise.all([
      this.query.visitsByDayAndChannel(current),
      this.query.sources(current, TOP_SOURCES),
      this.query.campaigns(current, TOP_CAMPAIGNS),
      this.query.channels(current),
    ]);
    const counted = {
      conversions: current.conversion !== null,
      revenue: carriesRevenue(current.conversion),
    };
    return {
      days: channelsPerDay(daysIn(current.range), byDay),
      sources: sources.map((source) => withConversionsWhenCounted(source, counted)),
      campaigns: campaigns.map((campaign) => withConversionsWhenCounted(campaign, counted)),
      channels: everyChannel(channels).map((channel) =>
        withConversionsWhenCounted(channel, counted),
      ),
    };
  }
}

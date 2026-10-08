import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import {
  ACQUISITION_QUERY,
  type AcquisitionQuery,
  type AcquisitionReport,
  channelsPerDay,
  TOP_CAMPAIGNS,
  TOP_SOURCES,
  withConversionsWhenCounted,
} from '../../domain/queries/acquisition';
import { daysIn } from '../../domain/queries/date-range';
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
    const [byDay, sources, campaigns] = await Promise.all([
      this.query.visitsByDayAndChannel(current),
      this.query.sources(current, TOP_SOURCES),
      this.query.campaigns(current, TOP_CAMPAIGNS),
    ]);
    const countConversions = project.conversionEvent !== null;
    return {
      days: channelsPerDay(daysIn(current.range), byDay),
      sources: sources.map((source) => withConversionsWhenCounted(source, countConversions)),
      campaigns: campaigns.map((campaign) =>
        withConversionsWhenCounted(campaign, countConversions),
      ),
    };
  }
}

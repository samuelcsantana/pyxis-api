import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import { daysIn } from '../../domain/queries/date-range';
import {
  FEATURES_QUERY,
  type FeatureKind,
  type FeaturesQuery,
  type FeaturesReport,
  TOP_FEATURES,
  withDailyCounts,
} from '../../domain/queries/features';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { type RequestedRange, scopedPeriods } from './scoped-periods';

@Injectable()
export class GetFeaturesUseCase {
  constructor(
    @Inject(FEATURES_QUERY) private readonly query: FeaturesQuery,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(
    project: Project,
    requested: RequestedRange,
    kind: FeatureKind,
  ): Promise<FeaturesReport> {
    const { current } = scopedPeriods(project, requested, this.clock.now());
    const totals = await this.query.totals(current, kind, TOP_FEATURES);
    const days =
      totals.length === 0
        ? []
        : await this.query.days(
            current,
            kind,
            totals.map((total) => total.name),
          );
    return { items: withDailyCounts(totals, daysIn(current.range), days) };
  }
}

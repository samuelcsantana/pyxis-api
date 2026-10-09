import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import {
  FUNNEL_QUERY,
  type FunnelQuery,
  type FunnelSegment,
  type FunnelSegmentDimension,
  type FunnelStep,
} from '../../domain/queries/funnel';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { type RequestedRange, scopedPeriods } from './scoped-periods';

@Injectable()
export class GetFunnelSegmentsUseCase {
  constructor(
    @Inject(FUNNEL_QUERY) private readonly query: FunnelQuery,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(
    project: Project,
    requested: RequestedRange,
    steps: readonly FunnelStep[],
    by: FunnelSegmentDimension,
  ): Promise<readonly FunnelSegment[]> {
    const { current } = scopedPeriods(project, requested, this.clock.now());
    return this.query.segments(current, steps, by);
  }
}

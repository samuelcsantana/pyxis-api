import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import {
  FUNNEL_QUERY,
  type FunnelMode,
  type FunnelQuery,
  type FunnelReport,
  type FunnelStep,
} from '../../domain/queries/funnel';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { type RequestedRange, scopedPeriods } from './scoped-periods';

@Injectable()
export class GetFunnelUseCase {
  constructor(
    @Inject(FUNNEL_QUERY) private readonly query: FunnelQuery,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(
    project: Project,
    requested: RequestedRange,
    mode: FunnelMode,
    steps: readonly FunnelStep[],
  ): Promise<FunnelReport> {
    const { current } = scopedPeriods(project, requested, this.clock.now());
    const counts = await this.query.count(current, mode, steps);
    return { steps: counts.map((count) => ({ count })) };
  }
}

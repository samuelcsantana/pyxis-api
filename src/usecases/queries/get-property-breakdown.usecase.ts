import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import {
  breakdownByKey,
  PROPERTY_BREAKDOWN_QUERY,
  type PropertyBreakdownQuery,
  type PropertyBreakdownReport,
  TOP_PROPERTY_VALUES,
} from '../../domain/queries/property-breakdown';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { type RequestedRange, scopedPeriods } from './scoped-periods';

@Injectable()
export class GetPropertyBreakdownUseCase {
  constructor(
    @Inject(PROPERTY_BREAKDOWN_QUERY) private readonly query: PropertyBreakdownQuery,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(
    project: Project,
    requested: RequestedRange,
    name: string,
  ): Promise<PropertyBreakdownReport> {
    const { current } = scopedPeriods(project, requested, this.clock.now());
    const counts = await this.query.counts(current, name, TOP_PROPERTY_VALUES);
    return { name, events: counts.events, keys: breakdownByKey(counts.values) };
  }
}

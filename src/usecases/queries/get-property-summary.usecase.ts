import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import {
  PROPERTY_SUMMARY_QUERY,
  type PropertySummaryQuery,
  type PropertySummaryReport,
  type PropertySummaryRequest,
  propertySummaryOf,
  TOP_SUMMARY_GROUPS,
} from '../../domain/queries/property-summary';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { type RequestedRange, scopedPeriods } from './scoped-periods';

@Injectable()
export class GetPropertySummaryUseCase {
  constructor(
    @Inject(PROPERTY_SUMMARY_QUERY) private readonly query: PropertySummaryQuery,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(
    project: Project,
    requested: RequestedRange,
    request: PropertySummaryRequest,
  ): Promise<PropertySummaryReport> {
    const { current } = scopedPeriods(project, requested, this.clock.now());
    const counts = await this.query.summarize(current, request, TOP_SUMMARY_GROUPS);
    return propertySummaryOf(request, counts);
  }
}

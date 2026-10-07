import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import { CLOCK, type Clock } from '../../domain/services/clock';
import {
  type VisitCursor,
  type VisitFilters,
  VISIT_LIST_PAGE_SIZE,
  VISITS_QUERY,
  type VisitsQuery,
  type VisitsReport,
  visitsPage,
} from '../../domain/queries/visits';
import { type RequestedRange, scopedPeriods } from './scoped-periods';

@Injectable()
export class GetVisitsUseCase {
  constructor(
    @Inject(VISITS_QUERY) private readonly query: VisitsQuery,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(
    project: Project,
    requested: RequestedRange,
    filters: VisitFilters,
    after: VisitCursor | null,
  ): Promise<VisitsReport> {
    const { current } = scopedPeriods(project, requested, this.clock.now());
    const items = await this.query.list(current, filters, after, VISIT_LIST_PAGE_SIZE + 1);
    return visitsPage(items, VISIT_LIST_PAGE_SIZE);
  }
}

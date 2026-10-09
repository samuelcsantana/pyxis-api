import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import {
  ENGAGEMENT_QUERY,
  type EngagementQuery,
  type EngagementReport,
  TOP_ENTRY_EXIT_PAGES,
  visitLengthBuckets,
} from '../../domain/queries/engagement';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { type RequestedRange, scopedPeriods } from './scoped-periods';

@Injectable()
export class GetEngagementUseCase {
  constructor(
    @Inject(ENGAGEMENT_QUERY) private readonly query: EngagementQuery,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(project: Project, requested: RequestedRange): Promise<EngagementReport> {
    const { current } = scopedPeriods(project, requested, this.clock.now());
    const [totals, lengths, entryPages, exitPages] = await Promise.all([
      this.query.totals(current),
      this.query.visitLengths(current),
      this.query.entryPages(current, TOP_ENTRY_EXIT_PAGES),
      this.query.exitPages(current, TOP_ENTRY_EXIT_PAGES),
    ]);
    return { ...totals, visitLengths: visitLengthBuckets(lengths), entryPages, exitPages };
  }
}

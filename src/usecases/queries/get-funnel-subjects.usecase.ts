import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import {
  FUNNEL_QUERY,
  FUNNEL_SUBJECTS_PAGE_SIZE,
  type FunnelQuery,
  type FunnelSubjectCursor,
  type FunnelSubjectsAsked,
  type FunnelSubjectsReport,
  funnelSubjectsPage,
} from '../../domain/queries/funnel';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { type RequestedRange, scopedPeriods } from './scoped-periods';

@Injectable()
export class GetFunnelSubjectsUseCase {
  constructor(
    @Inject(FUNNEL_QUERY) private readonly query: FunnelQuery,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(
    project: Project,
    requested: RequestedRange,
    asked: FunnelSubjectsAsked,
    after: FunnelSubjectCursor | null,
  ): Promise<FunnelSubjectsReport> {
    const { current } = scopedPeriods(project, requested, this.clock.now());
    const found = await this.query.subjects(current, asked, after, FUNNEL_SUBJECTS_PAGE_SIZE + 1);
    return funnelSubjectsPage(found, FUNNEL_SUBJECTS_PAGE_SIZE);
  }
}

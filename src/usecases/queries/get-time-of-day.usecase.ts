import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import {
  TIME_OF_DAY_QUERY,
  type TimeOfDayQuery,
  type TimeOfDayReport,
  weekdayHours,
} from '../../domain/queries/time-of-day';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { type RequestedRange, scopedPeriods } from './scoped-periods';

@Injectable()
export class GetTimeOfDayUseCase {
  constructor(
    @Inject(TIME_OF_DAY_QUERY) private readonly query: TimeOfDayQuery,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(project: Project, requested: RequestedRange): Promise<TimeOfDayReport> {
    const { current } = scopedPeriods(project, requested, this.clock.now());
    return weekdayHours(await this.query.visitStarts(current));
  }
}

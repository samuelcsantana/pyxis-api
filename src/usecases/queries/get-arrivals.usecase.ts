import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import {
  ARRIVALS_QUERY,
  type ArrivalsQuery,
  type ArrivalsReport,
  arrivalsAsk,
  arrivalsReport,
} from '../../domain/queries/arrivals';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { type RequestedRange, scopedPeriods } from './scoped-periods';

@Injectable()
export class GetArrivalsUseCase {
  constructor(
    @Inject(ARRIVALS_QUERY) private readonly query: ArrivalsQuery,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(project: Project, requested: RequestedRange, since: Date): Promise<ArrivalsReport> {
    const asOf = this.clock.now();
    const { current } = scopedPeriods(project, requested, asOf);
    const rows = await this.query.arrivals(arrivalsAsk(current, since, asOf));
    return arrivalsReport(rows, asOf);
  }
}

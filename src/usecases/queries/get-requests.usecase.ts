import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import {
  RECENT_FAILURES_PER_ROUTE,
  type RequestKind,
  REQUESTS_QUERY,
  type RequestsQuery,
  type RequestsReport,
  routeReports,
  TOP_ROUTES,
} from '../../domain/queries/requests';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { type RequestedRange, scopedPeriods } from './scoped-periods';

@Injectable()
export class GetRequestsUseCase {
  constructor(
    @Inject(REQUESTS_QUERY) private readonly query: RequestsQuery,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(
    project: Project,
    requested: RequestedRange,
    screen: string | null,
    kind: RequestKind,
  ): Promise<RequestsReport> {
    const { current } = scopedPeriods(project, requested, this.clock.now());
    const scope = { ...current, screen, kind };
    const [totals, statuses, screens, failures] = await Promise.all([
      this.query.routes(scope, TOP_ROUTES),
      this.query.statuses(scope),
      this.query.screens(scope),
      this.query.recentFailures(scope, RECENT_FAILURES_PER_ROUTE),
    ]);
    return { kind, routes: routeReports(totals, statuses, screens, failures) };
  }
}

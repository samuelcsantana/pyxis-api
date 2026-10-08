import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import { daysIn } from '../../domain/queries/date-range';
import {
  RECENT_FAILURES_PER_ROUTE,
  type RequestKind,
  REQUESTS_QUERY,
  type RequestsQuery,
  type RequestsReport,
  type RouteKey,
  routeDaysPerDay,
  routeReports,
  statusClassesPerDay,
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
    route: RouteKey | null,
  ): Promise<RequestsReport> {
    const { current } = scopedPeriods(project, requested, this.clock.now());
    const scope = { ...current, screen, kind };
    const dates = daysIn(current.range);
    const [totals, statuses, screens, failures, classes, routeDays] = await Promise.all([
      this.query.routes(scope, TOP_ROUTES),
      this.query.statuses(scope),
      this.query.screens(scope),
      this.query.recentFailures(scope, RECENT_FAILURES_PER_ROUTE),
      this.query.statusClassesByDay(scope),
      route === null ? null : this.query.routeDays(scope, route),
    ]);
    return {
      kind,
      routes: routeReports(totals, statuses, screens, failures),
      days: statusClassesPerDay(dates, classes),
      routeDays: routeDays === null ? null : routeDaysPerDay(dates, routeDays),
    };
  }
}

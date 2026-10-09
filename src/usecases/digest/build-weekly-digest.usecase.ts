import { Inject, Injectable } from '@nestjs/common';
import {
  DIGEST_FAILING_ROUTES,
  DIGEST_TOP_ITEMS,
  type FailingRoute,
  type WeeklyDigest,
} from '../../domain/digest/weekly-digest';
import type { Project } from '../../domain/entities/project.entity';
import { type DateRange, daysIn, previousRange } from '../../domain/queries/date-range';
import { OVERVIEW_QUERY, type OverviewQuery } from '../../domain/queries/overview';
import {
  NO_ACTIVITY,
  PROJECT_ACTIVITY_QUERY,
  type ProjectActivityQuery,
} from '../../domain/queries/project-activity';
import type { QueryScope } from '../../domain/queries/query-scope';
import { REQUESTS_QUERY, type RequestsQuery, type RouteTotal } from '../../domain/queries/requests';

function failingRoutes(routes: readonly RouteTotal[]): readonly FailingRoute[] {
  return routes
    .filter((route) => route.failed > 0)
    .map(({ method, route, failed, total }) => ({ method, route, failed, total }));
}

@Injectable()
export class BuildWeeklyDigestUseCase {
  constructor(
    @Inject(OVERVIEW_QUERY) private readonly overview: OverviewQuery,
    @Inject(REQUESTS_QUERY) private readonly requests: RequestsQuery,
    @Inject(PROJECT_ACTIVITY_QUERY) private readonly activity: ProjectActivityQuery,
  ) {}

  async execute(project: Project, week: DateRange): Promise<WeeklyDigest> {
    const current: QueryScope = {
      projectId: project.id,
      timeZone: project.timezone,
      conversionEvent: project.conversionEvent,
      range: week,
    };
    const previous: QueryScope = { ...current, range: previousRange(week) };
    const [now, before, sparseDays, topPages, topEvents, routes, activity] = await Promise.all([
      this.overview.totals(current),
      this.overview.totals(previous),
      this.overview.days(current),
      this.overview.topPages(current, DIGEST_TOP_ITEMS),
      this.overview.topEvents(current, DIGEST_TOP_ITEMS),
      this.requests.routes({ ...current, screen: null, kind: 'writes' }, DIGEST_FAILING_ROUTES),
      this.activity.activityOf([project.id]),
    ]);
    const visitsOn = new Map(sparseDays.map((day) => [day.date, day.visits]));
    return {
      projectId: project.id,
      projectName: project.name,
      timeZone: project.timezone,
      week,
      visits: { current: now.visits, previous: before.visits },
      identifiedUsers: { current: now.identifiedUsers, previous: before.identifiedUsers },
      convertingVisits:
        project.conversionEvent === null
          ? null
          : { current: now.convertingVisits, previous: before.convertingVisits },
      failedWrites: {
        current: { failed: now.failedWrites, total: now.writes },
        previous: { failed: before.failedWrites, total: before.writes },
      },
      days: daysIn(week).map((date) => ({ date, visits: visitsOn.get(date) ?? 0 })),
      topPages,
      topEvents,
      failingRoutes: failingRoutes(routes),
      lastEventAt: (activity.get(project.id) ?? NO_ACTIVITY).lastEventAt,
    };
  }
}

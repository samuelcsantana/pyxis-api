import type {
  RequestsQuery,
  RequestsScope,
  RouteDayDurations,
  RouteFailure,
  RouteKey,
  RouteScreenCount,
  RouteStatusCount,
  RouteTotal,
  StatusClassDayCount,
} from '../domain/queries/requests';

export class StubRequestsQuery implements RequestsQuery {
  readonly scopes: RequestsScope[] = [];
  readonly sizes: number[] = [];
  routesAnswer: readonly RouteTotal[] = [];
  statusesAnswer: readonly RouteStatusCount[] = [];
  screensAnswer: readonly RouteScreenCount[] = [];
  failuresAnswer: readonly RouteFailure[] = [];
  classesAnswer: readonly StatusClassDayCount[] = [];
  routeDaysAnswer: readonly RouteDayDurations[] = [];
  readonly askedRoutes: RouteKey[] = [];

  routes(scope: RequestsScope, limit: number): Promise<readonly RouteTotal[]> {
    this.scopes.push(scope);
    this.sizes.push(limit);
    return Promise.resolve(this.routesAnswer);
  }

  statuses(scope: RequestsScope): Promise<readonly RouteStatusCount[]> {
    this.scopes.push(scope);
    return Promise.resolve(this.statusesAnswer);
  }

  screens(scope: RequestsScope): Promise<readonly RouteScreenCount[]> {
    this.scopes.push(scope);
    return Promise.resolve(this.screensAnswer);
  }

  recentFailures(scope: RequestsScope, perRoute: number): Promise<readonly RouteFailure[]> {
    this.scopes.push(scope);
    this.sizes.push(perRoute);
    return Promise.resolve(this.failuresAnswer);
  }

  statusClassesByDay(scope: RequestsScope): Promise<readonly StatusClassDayCount[]> {
    this.scopes.push(scope);
    return Promise.resolve(this.classesAnswer);
  }

  routeDays(scope: RequestsScope, route: RouteKey): Promise<readonly RouteDayDurations[]> {
    this.scopes.push(scope);
    this.askedRoutes.push(route);
    return Promise.resolve(this.routeDaysAnswer);
  }
}

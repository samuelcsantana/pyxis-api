import type {
  RequestsQuery,
  RequestsScope,
  RouteFailure,
  RouteScreenCount,
  RouteStatusCount,
  RouteTotal,
} from '../domain/queries/requests';

export class StubRequestsQuery implements RequestsQuery {
  readonly scopes: RequestsScope[] = [];
  readonly sizes: number[] = [];
  routesAnswer: readonly RouteTotal[] = [];
  statusesAnswer: readonly RouteStatusCount[] = [];
  screensAnswer: readonly RouteScreenCount[] = [];
  failuresAnswer: readonly RouteFailure[] = [];

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
}

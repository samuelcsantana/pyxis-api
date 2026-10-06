import type {
  DayTotals,
  EventCount,
  OverviewQuery,
  PageCount,
  PeriodTotals,
} from '../domain/queries/overview';
import type { QueryScope } from '../domain/queries/query-scope';

const NO_TOTALS: PeriodTotals = {
  visits: 0,
  identifiedUsers: 0,
  conversions: 0,
  writes: 0,
  failedWrites: 0,
};

export class StubOverviewQuery implements OverviewQuery {
  readonly scopes: QueryScope[] = [];
  readonly totalsByFrom = new Map<string, PeriodTotals>();
  sparseDays: readonly DayTotals[] = [];
  pages: readonly PageCount[] = [];
  namedEvents: readonly EventCount[] = [];
  limits: number[] = [];

  totals(scope: QueryScope): Promise<PeriodTotals> {
    this.scopes.push(scope);
    return Promise.resolve(this.totalsByFrom.get(scope.range.from) ?? NO_TOTALS);
  }

  days(scope: QueryScope): Promise<readonly DayTotals[]> {
    this.scopes.push(scope);
    return Promise.resolve(this.sparseDays);
  }

  topPages(scope: QueryScope, limit: number): Promise<readonly PageCount[]> {
    this.scopes.push(scope);
    this.limits.push(limit);
    return Promise.resolve(this.pages);
  }

  topEvents(scope: QueryScope, limit: number): Promise<readonly EventCount[]> {
    this.scopes.push(scope);
    this.limits.push(limit);
    return Promise.resolve(this.namedEvents);
  }
}

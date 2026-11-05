import type {
  DayTotals,
  EventCount,
  OverviewQuery,
  PageCount,
  PeriodTotals,
} from '../domain/queries/overview';
import type { QueryScope } from '../domain/queries/query-scope';
import type { RevenueDay } from '../domain/queries/revenue';
import type { VisitorDay } from '../domain/queries/visitors';

const NO_TOTALS: PeriodTotals = {
  visits: 0,
  identifiedUsers: 0,
  conversions: 0,
  convertingVisits: 0,
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
  readonly visitorScopes: QueryScope[] = [];
  sparseVisitorDays: readonly VisitorDay[] = [];
  readonly revenueScopes: QueryScope[] = [];
  readonly revenueByFrom = new Map<string, number>();
  sparseRevenueDays: readonly RevenueDay[] = [];

  totals(scope: QueryScope): Promise<PeriodTotals> {
    this.scopes.push(scope);
    return Promise.resolve(this.totalsByFrom.get(scope.range.from) ?? NO_TOTALS);
  }

  days(scope: QueryScope): Promise<readonly DayTotals[]> {
    this.scopes.push(scope);
    return Promise.resolve(
      this.sparseDays.filter((day) => day.date >= scope.range.from && day.date <= scope.range.to),
    );
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

  visitorDays(scope: QueryScope): Promise<readonly VisitorDay[]> {
    this.visitorScopes.push(scope);
    return Promise.resolve(
      this.sparseVisitorDays.filter(
        (day) => day.date >= scope.range.from && day.date <= scope.range.to,
      ),
    );
  }

  revenueTotal(scope: QueryScope): Promise<number> {
    this.revenueScopes.push(scope);
    return Promise.resolve(this.revenueByFrom.get(scope.range.from) ?? 0);
  }

  revenueDays(scope: QueryScope): Promise<readonly RevenueDay[]> {
    this.revenueScopes.push(scope);
    return Promise.resolve(
      this.sparseRevenueDays.filter(
        (day) => day.date >= scope.range.from && day.date <= scope.range.to,
      ),
    );
  }
}

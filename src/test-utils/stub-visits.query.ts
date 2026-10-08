import type { QueryScope } from '../domain/queries/query-scope';
import type {
  VisitCursor,
  VisitFilters,
  VisitListItem,
  VisitMatches,
  VisitsQuery,
} from '../domain/queries/visits';

export class StubVisitsQuery implements VisitsQuery {
  readonly calls: {
    readonly scope: QueryScope;
    readonly filters: VisitFilters;
    readonly after: VisitCursor | null;
    readonly limit: number;
  }[] = [];
  items: readonly VisitListItem[] = [];
  total = 0;

  list(
    scope: QueryScope,
    filters: VisitFilters,
    after: VisitCursor | null,
    limit: number,
  ): Promise<VisitMatches> {
    this.calls.push({ scope, filters, after, limit });
    return Promise.resolve({ items: this.items, total: this.total });
  }
}

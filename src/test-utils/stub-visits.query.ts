import type { QueryScope } from '../domain/queries/query-scope';
import type {
  VisitCursor,
  VisitFilters,
  VisitListItem,
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

  list(
    scope: QueryScope,
    filters: VisitFilters,
    after: VisitCursor | null,
    limit: number,
  ): Promise<readonly VisitListItem[]> {
    this.calls.push({ scope, filters, after, limit });
    return Promise.resolve(this.items);
  }
}

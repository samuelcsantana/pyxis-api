import type {
  EngagementQuery,
  EntryPageCount,
  ExitPageCount,
  VisitLengthCount,
  VisitShapeTotals,
} from '../domain/queries/engagement';
import type { QueryScope } from '../domain/queries/query-scope';

export class StubEngagementQuery implements EngagementQuery {
  readonly asked: { readonly scope: QueryScope; readonly limit?: number }[] = [];
  entries: readonly EntryPageCount[] = [];
  exits: readonly ExitPageCount[] = [];
  shapeTotals: VisitShapeTotals = { visits: 0, singlePageVisits: 0, medianVisitSeconds: null };
  lengths: readonly VisitLengthCount[] = [];

  entryPages(scope: QueryScope, limit: number): Promise<readonly EntryPageCount[]> {
    this.asked.push({ scope, limit });
    return Promise.resolve(this.entries);
  }

  exitPages(scope: QueryScope, limit: number): Promise<readonly ExitPageCount[]> {
    this.asked.push({ scope, limit });
    return Promise.resolve(this.exits);
  }

  totals(scope: QueryScope): Promise<VisitShapeTotals> {
    this.asked.push({ scope });
    return Promise.resolve(this.shapeTotals);
  }

  visitLengths(scope: QueryScope): Promise<readonly VisitLengthCount[]> {
    this.asked.push({ scope });
    return Promise.resolve(this.lengths);
  }
}

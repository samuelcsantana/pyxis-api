import type { QueryScope } from '../domain/queries/query-scope';
import type { TimeOfDayQuery, VisitStartCell } from '../domain/queries/time-of-day';

export class StubTimeOfDayQuery implements TimeOfDayQuery {
  readonly asked: QueryScope[] = [];
  cells: readonly VisitStartCell[] = [];

  visitStarts(scope: QueryScope): Promise<readonly VisitStartCell[]> {
    this.asked.push(scope);
    return Promise.resolve(this.cells);
  }
}

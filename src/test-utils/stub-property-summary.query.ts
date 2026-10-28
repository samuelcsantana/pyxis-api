import type {
  PropertySummaryCounts,
  PropertySummaryQuery,
  PropertySummaryRequest,
} from '../domain/queries/property-summary';
import type { QueryScope } from '../domain/queries/query-scope';

export class StubPropertySummaryQuery implements PropertySummaryQuery {
  readonly asked: {
    readonly scope: QueryScope;
    readonly request: PropertySummaryRequest;
    readonly groups: number;
  }[] = [];
  answer: PropertySummaryCounts = {
    overall: { events: 0, median: null, p25: null, p75: null },
    groups: [],
    groupedEvents: 0,
  };

  summarize(
    scope: QueryScope,
    request: PropertySummaryRequest,
    groups: number,
  ): Promise<PropertySummaryCounts> {
    this.asked.push({ scope, request, groups });
    return Promise.resolve(this.answer);
  }
}

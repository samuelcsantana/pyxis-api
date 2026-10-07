import type { PropertyBreakdownQuery, PropertyCounts } from '../domain/queries/property-breakdown';
import type { QueryScope } from '../domain/queries/query-scope';

export class StubPropertyBreakdownQuery implements PropertyBreakdownQuery {
  readonly asked: { readonly scope: QueryScope; readonly name: string; readonly limit: number }[] =
    [];
  answer: PropertyCounts = { events: 0, values: [] };

  counts(scope: QueryScope, name: string, valuesPerKey: number): Promise<PropertyCounts> {
    this.asked.push({ scope, name, limit: valuesPerKey });
    return Promise.resolve(this.answer);
  }
}

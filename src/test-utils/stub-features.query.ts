import type {
  FeatureDayCount,
  FeatureKind,
  FeaturesQuery,
  FeatureTotal,
} from '../domain/queries/features';
import type { QueryScope } from '../domain/queries/query-scope';

export class StubFeaturesQuery implements FeaturesQuery {
  readonly asked: {
    readonly method: string;
    readonly kind: FeatureKind;
    readonly extra: unknown;
  }[] = [];
  readonly scopes: QueryScope[] = [];
  totalsAnswer: readonly FeatureTotal[] = [];
  daysAnswer: readonly FeatureDayCount[] = [];

  totals(scope: QueryScope, kind: FeatureKind, limit: number): Promise<readonly FeatureTotal[]> {
    this.scopes.push(scope);
    this.asked.push({ method: 'totals', kind, extra: limit });
    return Promise.resolve(this.totalsAnswer);
  }

  days(
    scope: QueryScope,
    kind: FeatureKind,
    names: readonly string[],
  ): Promise<readonly FeatureDayCount[]> {
    this.scopes.push(scope);
    this.asked.push({ method: 'days', kind, extra: names });
    return Promise.resolve(this.daysAnswer);
  }
}

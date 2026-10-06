import { Inject, Injectable } from '@nestjs/common';
import { inArray, sql } from 'drizzle-orm';
import type {
  FeatureDayCount,
  FeatureKind,
  FeaturesQuery,
  FeatureTotal,
} from '../../domain/queries/features';
import type { QueryScope } from '../../domain/queries/query-scope';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { events } from '../database/schema/events';
import { inScope, isNamedEvent, isPageView, localDay } from './definitions';

const KINDS = {
  events: { key: events.name, filter: isNamedEvent },
  screens: { key: events.path, filter: isPageView },
} as const satisfies Record<FeatureKind, unknown>;

@Injectable()
export class DrizzleFeaturesQuery implements FeaturesQuery {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async totals(
    scope: QueryScope,
    kind: FeatureKind,
    limit: number,
  ): Promise<readonly FeatureTotal[]> {
    const { key, filter } = KINDS[kind];
    const rows = await this.db.execute<{ name: string; count: number; visits: number }>(sql`
      SELECT ${key} AS "name",
        count(*)::int AS "count",
        count(DISTINCT ${events.sessionId})::int AS "visits"
      FROM ${events}
      WHERE ${inScope(scope)} AND ${filter}
      GROUP BY ${key}
      ORDER BY "count" DESC, "name"
      LIMIT ${limit}`);
    return [...rows];
  }

  async days(
    scope: QueryScope,
    kind: FeatureKind,
    names: readonly string[],
  ): Promise<readonly FeatureDayCount[]> {
    const { key, filter } = KINDS[kind];
    const rows = await this.db.execute<{ name: string; date: string; count: number }>(sql`
      SELECT ${key} AS "name", ${localDay(scope)} AS "date", count(*)::int AS "count"
      FROM ${events}
      WHERE ${inScope(scope)} AND ${filter} AND ${inArray(key, [...names])}
      GROUP BY 1, 2`);
    return [...rows];
  }
}

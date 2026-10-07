import { Inject, Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';
import type {
  PropertyBreakdownQuery,
  PropertyCounts,
  PropertyValueCount,
} from '../../domain/queries/property-breakdown';
import type { QueryScope } from '../../domain/queries/query-scope';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { events } from '../database/schema/events';
import { inScope, isNamedEvent } from './definitions';

function ofEvent(scope: QueryScope, name: string): SQL {
  return sql`${inScope(scope)} AND ${isNamedEvent} AND ${events.name} = ${name}`;
}

@Injectable()
export class DrizzlePropertyBreakdownQuery implements PropertyBreakdownQuery {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async counts(scope: QueryScope, name: string, valuesPerKey: number): Promise<PropertyCounts> {
    const [totals, values] = await Promise.all([
      this.db.execute<{ events: number }>(sql`
        SELECT count(*)::int AS "events" FROM ${events} WHERE ${ofEvent(scope, name)}`),
      this.db.execute<Record<keyof PropertyValueCount, string | number>>(sql`
        WITH ranked AS (
          SELECT property.key AS "key",
            property.value AS "value",
            count(*)::int AS "count",
            count(DISTINCT ${events.sessionId})::int AS "visits",
            (sum(count(*)) OVER (PARTITION BY property.key))::int AS "keyEvents",
            row_number() OVER (PARTITION BY property.key ORDER BY count(*) DESC, property.value)
              AS "rank"
          FROM ${events}, jsonb_each_text(${events.properties}) AS property
          WHERE ${ofEvent(scope, name)}
          GROUP BY property.key, property.value
        )
        SELECT "key", "value", "count", "visits", "keyEvents"
        FROM ranked
        WHERE "rank" <= ${valuesPerKey}`),
    ]);
    const [total] = totals as unknown as readonly [{ events: number }];
    return { events: total.events, values: values as unknown as readonly PropertyValueCount[] };
  }
}

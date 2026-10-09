import { Inject, Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';
import {
  type EngagementQuery,
  type EntryPageCount,
  type ExitPageCount,
  VISIT_LENGTH_BOUNDS_SECONDS,
  type VisitLengthCount,
  type VisitShapeTotals,
} from '../../domain/queries/engagement';
import type { QueryScope } from '../../domain/queries/query-scope';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { events } from '../database/schema/events';
import { inScope, isPageView } from './definitions';

function visitPages(scope: QueryScope): SQL {
  return sql`WITH "visitPages" AS (
    SELECT
      (array_agg(${events.path} ORDER BY ${events.occurredAt}, ${events.id})
        FILTER (WHERE ${isPageView}))[1] AS "entryPath",
      (array_agg(${events.path} ORDER BY ${events.occurredAt} DESC, ${events.id} DESC)
        FILTER (WHERE ${isPageView}))[1] AS "exitPath",
      count(*) FILTER (WHERE ${isPageView}) AS "pageViews",
      extract(epoch FROM max(${events.occurredAt}) - min(${events.occurredAt})) AS "seconds"
    FROM ${events}
    WHERE ${inScope(scope)}
    GROUP BY ${events.sessionId}
    HAVING count(*) FILTER (WHERE ${isPageView}) > 0
  )`;
}

@Injectable()
export class DrizzleEngagementQuery implements EngagementQuery {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async entryPages(scope: QueryScope, limit: number): Promise<readonly EntryPageCount[]> {
    const rows = await this.db.execute<{ path: string; visits: number; singlePageVisits: number }>(
      sql`${visitPages(scope)}
      SELECT "entryPath" AS "path",
        count(*)::int AS "visits",
        count(*) FILTER (WHERE "pageViews" = 1)::int AS "singlePageVisits"
      FROM "visitPages"
      GROUP BY "entryPath"
      ORDER BY "visits" DESC, "path"
      LIMIT ${limit}`,
    );
    return [...rows];
  }

  async exitPages(scope: QueryScope, limit: number): Promise<readonly ExitPageCount[]> {
    const rows = await this.db.execute<{ path: string; visits: number }>(
      sql`${visitPages(scope)}
      SELECT "exitPath" AS "path", count(*)::int AS "visits"
      FROM "visitPages"
      GROUP BY "exitPath"
      ORDER BY "visits" DESC, "path"
      LIMIT ${limit}`,
    );
    return [...rows];
  }

  async totals(scope: QueryScope): Promise<VisitShapeTotals> {
    const rows = await this.db.execute<{
      visits: number;
      singlePageVisits: number;
      medianVisitSeconds: number | null;
    }>(
      sql`${visitPages(scope)}
      SELECT count(*)::int AS "visits",
        count(*) FILTER (WHERE "pageViews" = 1)::int AS "singlePageVisits",
        round(percentile_cont(0.5) WITHIN GROUP (ORDER BY "seconds"))::int AS "medianVisitSeconds"
      FROM "visitPages"`,
    );
    const [totals] = rows as unknown as readonly [VisitShapeTotals];
    return totals;
  }

  async visitLengths(scope: QueryScope): Promise<readonly VisitLengthCount[]> {
    const bounds = sql.join(
      VISIT_LENGTH_BOUNDS_SECONDS.map((bound) => sql`${bound}`),
      sql`, `,
    );
    const rows = await this.db.execute<{ bucket: number; visits: number }>(
      sql`${visitPages(scope)}
      SELECT width_bucket("seconds", ARRAY[${bounds}]::numeric[])::int AS "bucket",
        count(*)::int AS "visits"
      FROM "visitPages"
      GROUP BY 1
      ORDER BY 1`,
    );
    return [...rows];
  }
}

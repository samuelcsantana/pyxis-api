import { Inject, Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';
import type { ArrivalRows, ArrivalsAsk, ArrivalsQuery } from '../../domain/queries/arrivals';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { events } from '../database/schema/events';
import {
  inScope,
  isConversion,
  isEntryPageView,
  isFailedRequest,
  isNamedEvent,
} from './definitions';

interface ActiveVisitsRow extends Record<string, unknown> {
  readonly visits: number;
}

@Injectable()
export class DrizzleArrivalsQuery implements ArrivalsQuery {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async arrivals(ask: ArrivalsAsk): Promise<ArrivalRows> {
    const [visits, conversions, namedEvents, failedRequests, activeVisits] = await Promise.all([
      this.arrivedSince(ask, isEntryPageView),
      ask.scope.conversionEvent === null
        ? Promise.resolve(null)
        : this.arrivedSince(ask, isConversion(ask.scope)),
      this.arrivedSince(ask, isNamedEvent),
      this.arrivedSince(ask, isFailedRequest),
      this.activeVisits(ask),
    ]);
    return { visits, conversions, namedEvents, failedRequests, activeVisits };
  }

  private async arrivedSince(ask: ArrivalsAsk, kind: SQL): Promise<readonly Date[]> {
    const rows = await this.db.execute<{ receivedAt: Date | string }>(sql`
      SELECT ${events.receivedAt} AS "receivedAt"
      FROM ${events}
      WHERE ${inScope(ask.scope)}
        AND ${events.receivedAt} > ${ask.since.toISOString()}::timestamptz
        AND ${kind}
      ORDER BY ${events.receivedAt} DESC
      LIMIT ${ask.limit}`);
    return rows.map((row) => new Date(row.receivedAt));
  }

  private async activeVisits(ask: ArrivalsAsk): Promise<number> {
    const rows = await this.db.execute<ActiveVisitsRow>(sql`
      SELECT count(DISTINCT ${events.sessionId})::int AS "visits"
      FROM ${events}
      WHERE ${events.projectId} = ${ask.scope.projectId}
        AND ${events.receivedAt} > ${ask.activeSince.toISOString()}::timestamptz`);
    const [row] = rows as unknown as readonly [ActiveVisitsRow];
    return row.visits;
  }
}

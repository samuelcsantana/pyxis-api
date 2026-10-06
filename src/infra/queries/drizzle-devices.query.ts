import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { DeviceDimension, DevicesQuery, ValueCount } from '../../domain/queries/devices';
import type { QueryScope } from '../../domain/queries/query-scope';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { events } from '../database/schema/events';
import { inScope, isConversion, visits } from './definitions';

const DIMENSION_COLUMNS = {
  deviceType: events.deviceType,
  browser: events.browser,
  os: events.os,
  country: events.country,
} as const satisfies Record<DeviceDimension, unknown>;

@Injectable()
export class DrizzleDevicesQuery implements DevicesQuery {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async breakdown(scope: QueryScope, dimension: DeviceDimension): Promise<readonly ValueCount[]> {
    const column = DIMENSION_COLUMNS[dimension];
    const rows = await this.db.execute<{
      value: string | null;
      visits: number;
      conversions: number;
    }>(
      sql`
        SELECT ${column} AS "value",
          ${visits} AS "visits",
          count(*) FILTER (WHERE ${isConversion(scope)})::int AS "conversions"
        FROM ${events}
        WHERE ${inScope(scope)}
        GROUP BY ${column}`,
    );
    return [...rows];
  }
}

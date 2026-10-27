import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type {
  DeviceDimension,
  DevicesQuery,
  RegionCount,
  ValueCount,
} from '../../domain/queries/devices';
import type { QueryScope } from '../../domain/queries/query-scope';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { events } from '../database/schema/events';
import { convertingVisits, isConversion, visits } from './definitions';
import { inScope } from './report-filters';

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
      convertingVisits: number;
    }>(
      sql`
        SELECT ${column} AS "value",
          ${visits} AS "visits",
          count(*) FILTER (WHERE ${isConversion(scope)})::int AS "conversions",
          ${convertingVisits(scope)} AS "convertingVisits"
        FROM ${events}
        WHERE ${inScope(scope)}
        GROUP BY ${column}`,
    );
    return [...rows];
  }

  async regions(scope: QueryScope): Promise<readonly RegionCount[]> {
    const rows = await this.db.execute<{
      region: string | null;
      name: string | null;
      visits: number;
      conversions: number;
      convertingVisits: number;
    }>(
      sql`
        SELECT ${events.region} AS "region",
          max(${events.regionName}) AS "name",
          ${visits} AS "visits",
          count(*) FILTER (WHERE ${isConversion(scope)})::int AS "conversions",
          ${convertingVisits(scope)} AS "convertingVisits"
        FROM ${events}
        WHERE ${inScope(scope)}
        GROUP BY ${events.region}`,
    );
    return [...rows];
  }
}

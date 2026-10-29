import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import {
  type DeviceDimension,
  DEVICES_QUERY,
  type DevicesQuery,
  type DevicesReport,
  reachOf,
  topCitiesAndRest,
  topRegionsAndRest,
  topValuesAndOther,
} from '../../domain/queries/devices';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { type RequestedRange, scopedPeriods } from './scoped-periods';

@Injectable()
export class GetDevicesUseCase {
  constructor(
    @Inject(DEVICES_QUERY) private readonly query: DevicesQuery,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(project: Project, requested: RequestedRange): Promise<DevicesReport> {
    const { current } = scopedPeriods(project, requested, this.clock.now());
    const countConversions = project.conversionEvent !== null;
    const shares = async (dimension: DeviceDimension) =>
      topValuesAndOther(await this.query.breakdown(current, dimension), countConversions);
    const [deviceType, browser, os, countryCounts, regionCounts, cityCounts, reachCounts] =
      await Promise.all([
        shares('deviceType'),
        shares('browser'),
        shares('os'),
        this.query.breakdown(current, 'country'),
        this.query.regions(current),
        this.query.cities(current),
        this.query.reach(current),
      ]);
    return {
      deviceType,
      browser,
      os,
      country: topValuesAndOther(countryCounts, countConversions),
      regions: topRegionsAndRest(regionCounts, countConversions),
      cities: topCitiesAndRest(cityCounts, countConversions),
      reach: reachOf(reachCounts, countryCounts, regionCounts),
    };
  }
}

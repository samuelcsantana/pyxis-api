import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import {
  type DeviceDimension,
  DEVICES_QUERY,
  type DevicesQuery,
  type DevicesReport,
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
    const [deviceType, browser, os, country] = await Promise.all([
      shares('deviceType'),
      shares('browser'),
      shares('os'),
      shares('country'),
    ]);
    return { deviceType, browser, os, country };
  }
}

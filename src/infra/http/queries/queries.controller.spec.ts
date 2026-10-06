import type { FastifyRequest } from 'fastify';
import type { Project } from '../../../domain/entities/project.entity';
import { type AcquisitionReport, noChannelVisits } from '../../../domain/queries/acquisition';
import type { DevicesReport } from '../../../domain/queries/devices';
import type { OverviewReport } from '../../../domain/queries/overview';
import type { GetAcquisitionUseCase } from '../../../usecases/queries/get-acquisition.usecase';
import type { GetDevicesUseCase } from '../../../usecases/queries/get-devices.usecase';
import type { GetOverviewUseCase } from '../../../usecases/queries/get-overview.usecase';
import { QueriesController } from './queries.controller';
import {
  acquisitionReportSchema,
  devicesReportSchema,
  overviewReportSchema,
} from './query.schemas';

const PROJECT: Project = {
  id: '6f1d3c2a-8b4e-4f7a-9c1d-2e3f4a5b6c7d',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'UTC',
  conversionEvent: 'signup_completed',
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};

const REPORT: OverviewReport = {
  kpis: {
    visits: { current: 3, previous: 2, daily: [1, 2] },
    identifiedUsers: { current: 1, previous: 0, daily: [0, 1] },
    conversions: { current: 1, previous: 1, daily: [1, 0] },
    writeErrors: {
      current: { failed: 1, total: 4 },
      previous: { failed: 0, total: 2 },
      daily: [
        { failed: 0, total: 1 },
        { failed: 1, total: 3 },
      ],
    },
  },
  days: [
    { date: '2026-10-04', pageViews: 5, events: 1 },
    { date: '2026-10-05', pageViews: 7, events: 2 },
  ],
  topPages: [{ path: '/pricing', views: 6, visits: 3 }],
  topEvents: [{ name: 'plan_selected', count: 2, visits: 2 }],
};

const DEVICES: DevicesReport = {
  deviceType: [{ value: 'mobile', visits: 4, conversions: 1 }],
  browser: [{ value: 'safari', visits: 4, conversions: 1 }],
  os: [{ value: 'ios', visits: 4, conversions: 1 }],
  country: [{ value: 'other', visits: 4, conversions: null }],
};

const ACQUISITION: AcquisitionReport = {
  days: [{ date: '2026-10-05', byChannel: { ...noChannelVisits(), paid: 2 } }],
  sources: [
    {
      source: 'google',
      medium: 'cpc',
      channel: 'paid',
      visits: 2,
      conversions: null,
      fromAdClickVisits: 2,
    },
  ],
};

function answering<Report>(report: Report, calls: unknown[][]) {
  return {
    execute: (...args: unknown[]) => {
      calls.push(args);
      return Promise.resolve(report);
    },
  };
}

function controllerAnswering(report: OverviewReport, devices: DevicesReport = DEVICES) {
  const calls: unknown[][] = [];
  const controller = new QueriesController(
    answering(report, calls) as unknown as GetOverviewUseCase,
    answering(devices, calls) as unknown as GetDevicesUseCase,
    answering(ACQUISITION, calls) as unknown as GetAcquisitionUseCase,
  );
  return { controller, calls };
}

describe('QueriesController', () => {
  it('asks for the overview of the guarded project and answers it in snake case', async () => {
    const { controller, calls } = controllerAnswering(REPORT);
    const range = { from: '2026-10-04', to: '2026-10-05' };

    const body = await controller.overview({ project: PROJECT } as FastifyRequest, range);

    expect(calls).toEqual([[PROJECT, range]]);
    expect(overviewReportSchema.parse(body)).toEqual(body);
    expect(body.kpis.identified_users).toEqual({ current: 1, previous: 0, daily: [0, 1] });
    expect(body.kpis.write_errors.current).toEqual({ failed: 1, total: 4 });
    expect(body.days[1]).toEqual({ date: '2026-10-05', page_views: 7, events: 2 });
  });

  it('keeps conversions null when the project has no conversion event', async () => {
    const { controller } = controllerAnswering({
      ...REPORT,
      kpis: { ...REPORT.kpis, conversions: null },
    });

    const body = await controller.overview({ project: PROJECT } as FastifyRequest, {
      from: '2026-10-04',
      to: '2026-10-05',
    });

    expect(body.kpis.conversions).toBeNull();
  });

  it('answers the devices of the guarded project in snake case', async () => {
    const { controller, calls } = controllerAnswering(REPORT);
    const range = { from: '2026-10-04', to: '2026-10-05' };

    const body = await controller.devices({ project: PROJECT } as FastifyRequest, range);

    expect(calls).toEqual([[PROJECT, range]]);
    expect(devicesReportSchema.parse(body)).toEqual({
      device_types: [{ value: 'mobile', visits: 4, conversions: 1 }],
      browsers: [{ value: 'safari', visits: 4, conversions: 1 }],
      operating_systems: [{ value: 'ios', visits: 4, conversions: 1 }],
      countries: [{ value: 'other', visits: 4, conversions: null }],
    });
  });

  it('answers the acquisition of the guarded project in snake case', async () => {
    const { controller, calls } = controllerAnswering(REPORT);
    const range = { from: '2026-10-05', to: '2026-10-05' };

    const body = await controller.acquisition({ project: PROJECT } as FastifyRequest, range);

    expect(calls).toEqual([[PROJECT, range]]);
    expect(acquisitionReportSchema.parse(body)).toEqual({
      days: [{ date: '2026-10-05', by_channel: { ...noChannelVisits(), paid: 2 } }],
      sources: [
        {
          source: 'google',
          medium: 'cpc',
          channel: 'paid',
          visits: 2,
          conversions: null,
          from_ad_click_visits: 2,
        },
      ],
    });
  });
});

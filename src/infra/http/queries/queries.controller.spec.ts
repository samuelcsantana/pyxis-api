import type { FastifyRequest } from 'fastify';
import type { Project } from '../../../domain/entities/project.entity';
import { type AcquisitionReport, noChannelVisits } from '../../../domain/queries/acquisition';
import type { DevicesReport } from '../../../domain/queries/devices';
import type { FeaturesReport } from '../../../domain/queries/features';
import type { RequestsReport } from '../../../domain/queries/requests';
import type { OverviewReport } from '../../../domain/queries/overview';
import type { GetAcquisitionUseCase } from '../../../usecases/queries/get-acquisition.usecase';
import type { GetDevicesUseCase } from '../../../usecases/queries/get-devices.usecase';
import type { GetFeaturesUseCase } from '../../../usecases/queries/get-features.usecase';
import type { GetFunnelUseCase } from '../../../usecases/queries/get-funnel.usecase';
import type { GetRequestsUseCase } from '../../../usecases/queries/get-requests.usecase';
import type { GetTimelineUseCase } from '../../../usecases/queries/get-timeline.usecase';
import type { TimelineReport } from '../../../domain/queries/timeline';
import type { GetOverviewUseCase } from '../../../usecases/queries/get-overview.usecase';
import { QueriesController } from './queries.controller';
import {
  acquisitionReportSchema,
  devicesReportSchema,
  featuresReportSchema,
  funnelQuerySchema,
  overviewReportSchema,
  requestsReportSchema,
  timelineQuerySchema,
  timelineReportSchema,
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
    convertingVisits: { current: 1, previous: 1, daily: [1, 0] },
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
  comparisonCutoff: '10:00:00.000',
  previousDays: [
    {
      date: '2026-10-02',
      pageViews: 4,
      events: 1,
      visits: 2,
      identifiedUsers: 0,
      conversions: 1,
      convertingVisits: 1,
      writeErrors: { failed: 0, total: 1 },
    },
    {
      date: '2026-10-03',
      pageViews: 3,
      events: 0,
      visits: 1,
      identifiedUsers: 0,
      conversions: 0,
      convertingVisits: 0,
      writeErrors: { failed: 0, total: 1 },
    },
  ],
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

const FEATURES: FeaturesReport = {
  items: [{ name: 'plan_selected', count: 3, visits: 2, daily: [1, 2] }],
};

const REQUESTS: RequestsReport = {
  routes: [
    {
      method: 'POST',
      route: '/v1/plans',
      total: 4,
      failed: 1,
      medianDurationMs: 80,
      statuses: [{ status: 500, count: 1 }],
      screens: [{ path: '/pricing', failed: 1 }],
      recentFailures: [
        {
          occurredAt: new Date('2026-10-05T12:00:00.000Z'),
          status: 500,
          errorCode: null,
          sessionId: '0b7e1c2d-3f4a-4b5c-9d6e-7f8a9b0c1d2e',
        },
      ],
    },
  ],
};

const TIMELINE: TimelineReport = {
  visits: [
    {
      sessionId: '0b7e1c2d-3f4a-4b5c-9d6e-7f8a9b0c1d2e',
      startedAt: new Date('2026-10-04T12:00:00.000Z'),
      endedAt: new Date('2026-10-04T12:05:00.000Z'),
      deviceType: 'mobile',
      browser: 'safari',
      os: 'ios',
      country: 'BR',
      channel: 'paid',
      events: [
        {
          id: '9f1c2b3a-1d2e-4f5a-8b6c-000000000001',
          occurredAt: new Date('2026-10-04T12:03:00.000Z'),
          name: 'calculator_used',
          path: '/calculator',
          properties: { plan: 'mei' },
        },
      ],
    },
  ],
  nextBefore: new Date('2026-10-04T12:00:00.000Z'),
};

function answering<Report>(report: Report, calls: unknown[][]) {
  return {
    execute: (...args: unknown[]) => {
      calls.push(args);
      return Promise.resolve(report);
    },
  };
}

function controllerAnswering(
  report: OverviewReport,
  devices: DevicesReport = DEVICES,
  timeline: TimelineReport = TIMELINE,
) {
  const calls: unknown[][] = [];
  const controller = new QueriesController(
    answering(report, calls) as unknown as GetOverviewUseCase,
    answering(devices, calls) as unknown as GetDevicesUseCase,
    answering(ACQUISITION, calls) as unknown as GetAcquisitionUseCase,
    answering(FEATURES, calls) as unknown as GetFeaturesUseCase,
    answering(REQUESTS, calls) as unknown as GetRequestsUseCase,
    answering({ steps: [{ count: 5 }, { count: 2 }] }, calls) as unknown as GetFunnelUseCase,
    answering(timeline, calls) as unknown as GetTimelineUseCase,
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
    expect(body.kpis.converting_visits).toEqual({ current: 1, previous: 1, daily: [1, 0] });
    expect(body.kpis.write_errors.current).toEqual({ failed: 1, total: 4 });
    expect(body.days[1]).toEqual({ date: '2026-10-05', page_views: 7, events: 2 });
    expect(body.comparison_cutoff).toBe('10:00:00.000');
    expect(body.previous_days[0]).toEqual({
      date: '2026-10-02',
      page_views: 4,
      events: 1,
      visits: 2,
      identified_users: 0,
      conversions: 1,
      converting_visits: 1,
      write_errors: { failed: 0, total: 1 },
    });
  });

  it('answers a null cutoff when the range is over', async () => {
    const { controller } = controllerAnswering({ ...REPORT, comparisonCutoff: null });

    const body = await controller.overview({ project: PROJECT } as FastifyRequest, {
      from: '2026-10-04',
      to: '2026-10-05',
    });

    expect(overviewReportSchema.parse(body).comparison_cutoff).toBeNull();
  });

  it('keeps conversions null when the project has no conversion event', async () => {
    const { controller } = controllerAnswering({
      ...REPORT,
      kpis: { ...REPORT.kpis, conversions: null, convertingVisits: null },
    });

    const body = await controller.overview({ project: PROJECT } as FastifyRequest, {
      from: '2026-10-04',
      to: '2026-10-05',
    });

    expect(body.kpis.conversions).toBeNull();
    expect(body.kpis.converting_visits).toBeNull();
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

  it('asks for the features of one kind and answers them', async () => {
    const { controller, calls } = controllerAnswering(REPORT);

    const body = await controller.features({ project: PROJECT } as FastifyRequest, {
      from: '2026-10-04',
      to: '2026-10-05',
      kind: 'events',
    });

    expect(calls).toEqual([[PROJECT, { from: '2026-10-04', to: '2026-10-05' }, 'events']]);
    expect(featuresReportSchema.parse(body)).toEqual({
      items: [{ name: 'plan_selected', count: 3, visits: 2, daily: [1, 2] }],
    });
  });

  it('asks for the requests of one screen, or of all, and answers them in snake case', async () => {
    const { controller, calls } = controllerAnswering(REPORT);
    const range = { from: '2026-10-05', to: '2026-10-05' };

    const body = await controller.requests({ project: PROJECT } as FastifyRequest, {
      ...range,
      screen: '/pricing',
    });
    await controller.requests({ project: PROJECT } as FastifyRequest, range);

    expect(calls).toEqual([
      [PROJECT, range, '/pricing'],
      [PROJECT, range, null],
    ]);
    expect(requestsReportSchema.parse(body).routes[0]).toEqual({
      method: 'POST',
      route: '/v1/plans',
      total: 4,
      failed: 1,
      statuses: [{ status: 500, count: 1 }],
      median_duration_ms: 80,
      screens: [{ path: '/pricing', failed: 1 }],
      recent_failures: [
        {
          occurred_at: '2026-10-05T12:00:00.000Z',
          status: 500,
          error_code: null,
          session_id: '0b7e1c2d-3f4a-4b5c-9d6e-7f8a9b0c1d2e',
        },
      ],
    });
  });

  it('asks for the funnel in the mode asked, with the parsed steps', async () => {
    const { controller, calls } = controllerAnswering(REPORT);
    const query = funnelQuerySchema.parse({
      from: '2026-10-01',
      to: '2026-10-05',
      mode: 'visit',
      steps: JSON.stringify([
        { type: 'page', path: '/calculator-*' },
        { type: 'event', name: 'signup_completed' },
      ]),
    });

    const body = await controller.funnel({ project: PROJECT } as FastifyRequest, query);

    expect(body).toEqual({ steps: [{ count: 5 }, { count: 2 }] });
    expect(calls).toEqual([
      [
        PROJECT,
        { from: '2026-10-01', to: '2026-10-05' },
        'visit',
        [
          { type: 'page', path: '/calculator-*' },
          { type: 'event', name: 'signup_completed' },
        ],
      ],
    ]);
  });

  it('asks for the timeline of a person and answers it with a cursor', async () => {
    const { controller, calls } = controllerAnswering(REPORT);

    const body = await controller.timeline(
      { project: PROJECT } as FastifyRequest,
      timelineQuerySchema.parse({ user_id: 'ana', before: '2026-10-05T00:00:00.000Z' }),
    );

    expect(calls).toEqual([[PROJECT, { userId: 'ana' }, new Date('2026-10-05T00:00:00.000Z')]]);
    expect(timelineReportSchema.parse(body)).toEqual({
      visits: [
        {
          session_id: '0b7e1c2d-3f4a-4b5c-9d6e-7f8a9b0c1d2e',
          started_at: '2026-10-04T12:00:00.000Z',
          ended_at: '2026-10-04T12:05:00.000Z',
          device_type: 'mobile',
          browser: 'safari',
          os: 'ios',
          country: 'BR',
          channel: 'paid',
          events: [
            {
              id: '9f1c2b3a-1d2e-4f5a-8b6c-000000000001',
              occurred_at: '2026-10-04T12:03:00.000Z',
              name: 'calculator_used',
              path: '/calculator',
              properties: { plan: 'mei' },
            },
          ],
        },
      ],
      next_before: '2026-10-04T12:00:00.000Z',
    });
  });

  it('asks for one visit and answers no cursor on the last page', async () => {
    const { controller, calls } = controllerAnswering(REPORT, DEVICES, {
      visits: [],
      nextBefore: null,
    });

    const body = await controller.timeline(
      { project: PROJECT } as FastifyRequest,
      timelineQuerySchema.parse({ session_id: '0b7e1c2d-3f4a-4b5c-9d6e-7f8a9b0c1d2e' }),
    );

    expect(calls).toEqual([[PROJECT, { sessionId: '0b7e1c2d-3f4a-4b5c-9d6e-7f8a9b0c1d2e' }, null]]);
    expect(body).toEqual({ visits: [], next_before: null });
  });
});

describe('timelineQuerySchema', () => {
  it.each([
    ['neither a user nor a visit', {}],
    [
      'both a user and a visit',
      { user_id: 'ana', session_id: '0b7e1c2d-3f4a-4b5c-9d6e-7f8a9b0c1d2e' },
    ],
    ['a visit id that is not a UUID', { session_id: 'visit-1' }],
    ['a cursor that is not a timestamp', { user_id: 'ana', before: 'yesterday' }],
  ])('refuses %s', (_case, query) => {
    expect(timelineQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe('funnelQuerySchema', () => {
  const base = { from: '2026-10-01', to: '2026-10-05', mode: 'user' };
  const step = { type: 'event', name: 'plan_selected' };

  it.each([
    ['text that is not JSON', 'not json'],
    ['a single step', JSON.stringify([step])],
    ['nine steps', JSON.stringify(Array.from({ length: 9 }, () => step))],
    ['a page step without a leading slash', JSON.stringify([step, { type: 'page', path: 'x' }])],
    ['an unknown step type', JSON.stringify([step, { type: 'click', name: 'x' }])],
  ])('refuses %s', (_case, steps) => {
    expect(funnelQuerySchema.safeParse({ ...base, steps }).success).toBe(false);
  });

  it('accepts eight steps', () => {
    const steps = JSON.stringify(Array.from({ length: 8 }, () => step));

    expect(funnelQuerySchema.safeParse({ ...base, steps }).success).toBe(true);
  });
});

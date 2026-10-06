import type { FastifyRequest } from 'fastify';
import type { Project } from '../../../domain/entities/project.entity';
import type { OverviewReport } from '../../../domain/queries/overview';
import type { GetOverviewUseCase } from '../../../usecases/queries/get-overview.usecase';
import { QueriesController } from './queries.controller';
import { overviewReportSchema } from './query.schemas';

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

function controllerAnswering(report: OverviewReport) {
  const calls: unknown[][] = [];
  const getOverview = {
    execute: (...args: unknown[]) => {
      calls.push(args);
      return Promise.resolve(report);
    },
  } as unknown as GetOverviewUseCase;
  return { controller: new QueriesController(getOverview), calls };
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
});

import type { FastifyRequest } from 'fastify';
import type { Project } from '../../../domain/entities/project.entity';
import type { ArrivalsReport } from '../../../domain/queries/arrivals';
import type { GetArrivalsUseCase } from '../../../usecases/queries/get-arrivals.usecase';
import { ArrivalsController } from './arrivals.controller';
import { arrivalsReportSchema } from './arrivals.schemas';

const PROJECT: Project = {
  id: '6f1d3c2a-8b4e-4f7a-9c1d-2e3f4a5b6c7d',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'UTC',
  conversionEvent: null,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};

const REPORT: ArrivalsReport = {
  asOf: new Date('2026-10-23T17:05:12.000Z'),
  activeVisits: 4,
  visits: { times: [new Date('2026-10-23T17:04:59.000Z')], more: false },
  conversions: null,
  namedEvents: { times: [], more: true },
  failedRequests: { times: [new Date('2026-10-23T17:01:00.000Z')], more: false },
};

describe('ArrivalsController', () => {
  it('asks for the range and the moment, and answers in the contract shape', async () => {
    const calls: unknown[][] = [];
    const useCase = {
      execute: (...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve(REPORT);
      },
    };
    const controller = new ArrivalsController(useCase as unknown as GetArrivalsUseCase);

    const body = await controller.arrivals({ project: PROJECT } as FastifyRequest, {
      from: '2026-10-23',
      to: '2026-10-23',
      since: '2026-10-23T14:00:00-03:00',
    });

    expect(calls).toEqual([
      [PROJECT, { from: '2026-10-23', to: '2026-10-23' }, new Date('2026-10-23T17:00:00.000Z')],
    ]);
    expect(arrivalsReportSchema.parse(body)).toEqual({
      as_of: '2026-10-23T17:05:12.000Z',
      active_visits: 4,
      visits: { times: ['2026-10-23T17:04:59.000Z'], more: false },
      conversions: null,
      named_events: { times: [], more: true },
      failed_requests: { times: ['2026-10-23T17:01:00.000Z'], more: false },
    });
  });

  it('answers the conversions when the project has a conversion event', async () => {
    const useCase = {
      execute: () =>
        Promise.resolve({ ...REPORT, conversions: { times: REPORT.visits.times, more: false } }),
    };
    const controller = new ArrivalsController(useCase as unknown as GetArrivalsUseCase);

    const body = await controller.arrivals({ project: PROJECT } as FastifyRequest, {
      from: '2026-10-23',
      to: '2026-10-23',
      since: '2026-10-23T17:00:00Z',
    });

    expect(body.conversions).toEqual({ times: ['2026-10-23T17:04:59.000Z'], more: false });
  });
});

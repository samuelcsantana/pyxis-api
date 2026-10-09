import type { FastifyRequest } from 'fastify';
import type { Project } from '../../../domain/entities/project.entity';
import type { GetFunnelSegmentsUseCase } from '../../../usecases/queries/get-funnel-segments.usecase';
import { FunnelSegmentsController } from './funnel-segments.controller';
import { funnelSegmentsQuerySchema, funnelSegmentsReportSchema } from './funnel-segments.schemas';

const PROJECT: Project = {
  id: '6f1d3c2a-8b4e-4f7a-9c1d-2e3f4a5b6c7d',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'UTC',
  conversionEvent: 'signup_completed',
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};
const STEPS = JSON.stringify([
  { type: 'page', path: '/pricing' },
  { type: 'event', name: 'signup_completed' },
]);
const BASE = { from: '2026-10-04', to: '2026-10-05', steps: STEPS };

describe('FunnelSegmentsController', () => {
  it('asks for the segments of the steps and answers them in the contract shape', async () => {
    const calls: unknown[][] = [];
    const useCase = {
      execute: (...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve([{ segment: 'mobile', counts: [5, 2] }]);
      },
    };
    const controller = new FunnelSegmentsController(useCase as unknown as GetFunnelSegmentsUseCase);

    const body = await controller.segments(
      { project: PROJECT } as FastifyRequest,
      funnelSegmentsQuerySchema.parse({ ...BASE, by: 'device' }),
    );

    expect(calls).toEqual([
      [
        PROJECT,
        { from: '2026-10-04', to: '2026-10-05' },
        [
          { type: 'page', path: '/pricing' },
          { type: 'event', name: 'signup_completed' },
        ],
        'device',
      ],
    ]);
    expect(funnelSegmentsReportSchema.parse(body)).toEqual({
      by: 'device',
      segments: [{ segment: 'mobile', steps: [5, 2] }],
    });
  });

  it('refuses a dimension it does not segment by', () => {
    expect(funnelSegmentsQuerySchema.safeParse({ ...BASE, by: 'country' }).success).toBe(false);
  });
});

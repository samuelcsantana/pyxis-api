import type { FastifyRequest } from 'fastify';
import type { Project } from '../../../domain/entities/project.entity';
import { visitLengthBuckets } from '../../../domain/queries/engagement';
import type { GetEngagementUseCase } from '../../../usecases/queries/get-engagement.usecase';
import { EngagementController } from './engagement.controller';
import { engagementReportSchema } from './engagement.schemas';

const PROJECT: Project = {
  id: '6f1d3c2a-8b4e-4f7a-9c1d-2e3f4a5b6c7d',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'UTC',
  conversionEvent: null,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};
const RANGE = { from: '2026-10-04', to: '2026-10-05' };

describe('EngagementController', () => {
  it('asks for the range of the project and answers in the contract shape', async () => {
    const calls: unknown[][] = [];
    const useCase = {
      execute: (...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve({
          visits: 3,
          singlePageVisits: 1,
          medianVisitSeconds: 50,
          visitLengths: visitLengthBuckets([{ bucket: 6, visits: 1 }]),
          entryPages: [{ path: '/', visits: 2, singlePageVisits: 1 }],
          exitPages: [{ path: '/pricing', visits: 1 }],
        });
      },
    };
    const controller = new EngagementController(useCase as unknown as GetEngagementUseCase);

    const body = await controller.engagement({ project: PROJECT } as FastifyRequest, RANGE);

    expect(calls).toEqual([[PROJECT, RANGE]]);
    const parsed = engagementReportSchema.parse(body);
    expect(parsed).toMatchObject({
      visits: 3,
      single_page_visits: 1,
      median_visit_seconds: 50,
      entry_pages: [{ path: '/', visits: 2, single_page_visits: 1 }],
      exit_pages: [{ path: '/pricing', visits: 1 }],
    });
    expect(parsed.visit_lengths.at(-1)).toEqual({ up_to_seconds: null, visits: 1 });
  });
});

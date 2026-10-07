import type { FastifyRequest } from 'fastify';
import type { Project } from '../../../domain/entities/project.entity';
import type { PropertyBreakdownReport } from '../../../domain/queries/property-breakdown';
import type { GetPropertyBreakdownUseCase } from '../../../usecases/queries/get-property-breakdown.usecase';
import { PropertyBreakdownController } from './property-breakdown.controller';
import {
  propertyBreakdownQuerySchema,
  propertyBreakdownReportSchema,
} from './property-breakdown.schemas';

const PROJECT: Project = {
  id: '6f1d3c2a-8b4e-4f7a-9c1d-2e3f4a5b6c7d',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'UTC',
  conversionEvent: 'signup_completed',
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};

const REPORT: PropertyBreakdownReport = {
  name: 'calculator_result_shown',
  events: 7,
  keys: [
    {
      key: 'calculator',
      events: 7,
      values: [
        { value: 'ifood', count: 4, visits: 3 },
        { value: '99food', count: 2, visits: 2 },
      ],
      otherCount: 1,
    },
  ],
};

describe('PropertyBreakdownController', () => {
  it('asks for one event of the guarded project and answers its keys in snake case', async () => {
    const calls: unknown[][] = [];
    const controller = new PropertyBreakdownController({
      execute: (...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve(REPORT);
      },
    } as unknown as GetPropertyBreakdownUseCase);

    const body = await controller.properties({ project: PROJECT } as FastifyRequest, {
      from: '2026-10-04',
      to: '2026-10-05',
      name: 'calculator_result_shown',
    });

    expect(calls).toEqual([
      [PROJECT, { from: '2026-10-04', to: '2026-10-05' }, 'calculator_result_shown'],
    ]);
    expect(propertyBreakdownReportSchema.parse(body)).toEqual({
      name: 'calculator_result_shown',
      events: 7,
      keys: [
        {
          key: 'calculator',
          events: 7,
          values: [
            { value: 'ifood', count: 4, visits: 3 },
            { value: '99food', count: 2, visits: 2 },
          ],
          other_count: 1,
        },
      ],
    });
  });
});

describe('propertyBreakdownQuerySchema', () => {
  const RANGE = { from: '2026-10-04', to: '2026-10-05' };

  it('accepts a named event', () => {
    expect(propertyBreakdownQuerySchema.parse({ ...RANGE, name: 'cta_clicked' }).name).toBe(
      'cta_clicked',
    );
  });

  it.each(['', 'Cta', '1cta', 'cta-clicked', `e${'x'.repeat(64)}`])(
    'refuses %j as an event name',
    (name) => {
      expect(propertyBreakdownQuerySchema.safeParse({ ...RANGE, name }).success).toBe(false);
    },
  );
});

import type { FastifyRequest } from 'fastify';
import type { Project } from '../../../domain/entities/project.entity';
import { NO_REPORT_FILTERS } from '../../../domain/queries/report-filters';
import type { PropertyBreakdownReport } from '../../../domain/queries/property-breakdown';
import type { PropertySummaryReport } from '../../../domain/queries/property-summary';
import type { GetPropertyBreakdownUseCase } from '../../../usecases/queries/get-property-breakdown.usecase';
import type { GetPropertySummaryUseCase } from '../../../usecases/queries/get-property-summary.usecase';
import { PropertyBreakdownController } from './property-breakdown.controller';
import {
  propertyBreakdownQuerySchema,
  propertyBreakdownReportSchema,
} from './property-breakdown.schemas';
import {
  propertySummaryQuerySchema,
  propertySummaryReportSchema,
} from './property-summary.schemas';

const PROJECT: Project = {
  id: '6f1d3c2a-8b4e-4f7a-9c1d-2e3f4a5b6c7d',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'UTC',
  conversionEvent: 'signup_completed',
  cityEnabled: false,
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

const NO_SUMMARY = {
  execute: () => Promise.reject(new Error('no summary expected')),
} as unknown as GetPropertySummaryUseCase;

const SUMMARY: PropertySummaryReport = {
  name: 'article_read_100',
  key: 'seconds',
  by: 'post',
  overall: { events: 6, median: 33, p25: 15, p75: 39 },
  groups: [{ value: 'angular-features', events: 2, median: 27, p25: 15, p75: 39 }],
  otherCount: 1,
};

describe('PropertyBreakdownController', () => {
  it('asks for one event of the guarded project and answers its keys in snake case', async () => {
    const calls: unknown[][] = [];
    const controller = new PropertyBreakdownController(
      {
        execute: (...args: unknown[]) => {
          calls.push(args);
          return Promise.resolve(REPORT);
        },
      } as unknown as GetPropertyBreakdownUseCase,
      NO_SUMMARY,
    );

    const body = await controller.properties(
      { project: PROJECT } as FastifyRequest,
      propertyBreakdownQuerySchema.parse({
        from: '2026-10-04',
        to: '2026-10-05',
        name: 'calculator_result_shown',
        event: 'signup_completed',
        property: 'plan=pro',
      }),
    );

    expect(calls).toEqual([
      [
        PROJECT,
        {
          from: '2026-10-04',
          to: '2026-10-05',
          filters: {
            ...NO_REPORT_FILTERS,
            event: { name: 'signup_completed', property: { key: 'plan', value: 'pro' } },
          },
        },
        'calculator_result_shown',
      ],
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

describe('PropertyBreakdownController.summary', () => {
  it('asks the summary of one property of the guarded project and answers it in snake case', async () => {
    const calls: unknown[][] = [];
    const controller = new PropertyBreakdownController(
      {} as GetPropertyBreakdownUseCase,
      {
        execute: (...args: unknown[]) => {
          calls.push(args);
          return Promise.resolve(SUMMARY);
        },
      } as unknown as GetPropertySummaryUseCase,
    );

    const body = await controller.summary(
      { project: PROJECT } as FastifyRequest,
      propertySummaryQuerySchema.parse({
        from: '2026-10-04',
        to: '2026-10-05',
        name: 'article_read_100',
        key: 'seconds',
        by: 'post',
        device: 'mobile',
      }),
    );

    expect(calls).toEqual([
      [
        PROJECT,
        {
          from: '2026-10-04',
          to: '2026-10-05',
          filters: { ...NO_REPORT_FILTERS, deviceType: 'mobile' },
        },
        { name: 'article_read_100', key: 'seconds', by: 'post' },
      ],
    ]);
    expect(propertySummaryReportSchema.parse(body)).toEqual({
      name: 'article_read_100',
      key: 'seconds',
      by: 'post',
      overall: { events: 6, median: 33, p25: 15, p75: 39 },
      groups: [{ value: 'angular-features', events: 2, median: 27, p25: 15, p75: 39 }],
      other_count: 1,
    });
  });

  it('asks without a split when by is left out', async () => {
    const calls: unknown[][] = [];
    const controller = new PropertyBreakdownController(
      {} as GetPropertyBreakdownUseCase,
      {
        execute: (...args: unknown[]) => {
          calls.push(args);
          return Promise.resolve({ ...SUMMARY, by: null, groups: [], otherCount: 0 });
        },
      } as unknown as GetPropertySummaryUseCase,
    );

    await controller.summary(
      { project: PROJECT } as FastifyRequest,
      propertySummaryQuerySchema.parse({
        from: '2026-10-04',
        to: '2026-10-05',
        name: 'article_read_100',
        key: 'seconds',
      }),
    );

    expect(calls[0]?.[2]).toEqual({ name: 'article_read_100', key: 'seconds', by: null });
  });
});

describe('propertySummaryQuerySchema', () => {
  it('refuses a key or a split that is not a property key, and a property filter without event', () => {
    const base = { from: '2026-10-04', to: '2026-10-05', name: 'article_read_100' };

    expect(propertySummaryQuerySchema.safeParse({ ...base, key: 'Seconds' }).success).toBe(false);
    expect(
      propertySummaryQuerySchema.safeParse({ ...base, key: 'seconds', by: 'a b' }).success,
    ).toBe(false);
    expect(propertySummaryQuerySchema.safeParse({ ...base }).success).toBe(false);
    expect(
      propertySummaryQuerySchema.safeParse({ ...base, key: 'seconds', property: 'plan=pro' })
        .success,
    ).toBe(false);
    expect(propertySummaryQuerySchema.safeParse({ ...base, key: 'seconds' }).success).toBe(true);
  });
});

describe('propertyBreakdownQuerySchema', () => {
  const RANGE = { from: '2026-10-04', to: '2026-10-05' };

  it('refuses a property filter without an event', () => {
    expect(
      propertyBreakdownQuerySchema.safeParse({
        ...RANGE,
        name: 'cta_clicked',
        property: 'plan=pro',
      }).success,
    ).toBe(false);
  });

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

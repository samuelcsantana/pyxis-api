import type { FastifyRequest } from 'fastify';
import type { Project } from '../../../domain/entities/project.entity';
import { NO_VISIT_FILTERS, type VisitsReport } from '../../../domain/queries/visits';
import type { GetVisitsUseCase } from '../../../usecases/queries/get-visits.usecase';
import { VisitsController } from './visits.controller';
import { visitCursorText, visitsQuerySchema, visitsReportSchema } from './visits.schemas';

const PROJECT: Project = {
  id: '6f1d3c2a-8b4e-4f7a-9c1d-2e3f4a5b6c7d',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'UTC',
  conversionEvent: 'signup_completed',
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};

const SESSION_ID = '0b7e1c2d-3f4a-4b5c-9d6e-7f8a9b0c1d2e';
const RANGE = { from: '2026-10-04', to: '2026-10-05' };

const REPORT: VisitsReport = {
  visits: [
    {
      sessionId: SESSION_ID,
      startedAt: new Date('2026-10-05T12:00:00.000Z'),
      endedAt: new Date('2026-10-05T12:04:30.000Z'),
      entryPath: '/calculator',
      pageViews: 3,
      highlights: ['calculator_result_shown', 'signup_completed'],
      failedRequests: 1,
      deviceType: 'mobile',
      browser: 'safari',
      os: 'ios',
      country: 'BR',
      channel: 'paid',
      userId: 'u_7f3a',
    },
  ],
  nextCursor: { startedAt: new Date('2026-10-05T12:00:00.000Z'), sessionId: SESSION_ID },
};

function controllerAnswering(report: VisitsReport) {
  const calls: unknown[][] = [];
  const useCase = {
    execute: (...args: unknown[]) => {
      calls.push(args);
      return Promise.resolve(report);
    },
  };
  return { controller: new VisitsController(useCase as unknown as GetVisitsUseCase), calls };
}

describe('VisitsController', () => {
  it('asks for the visits with every filter and answers them in snake case with a cursor', async () => {
    const { controller, calls } = controllerAnswering(REPORT);

    const body = await controller.visits(
      { project: PROJECT } as FastifyRequest,
      visitsQuerySchema.parse({
        ...RANGE,
        path: ['/calculadora-taxa-ifood', '/calculadora-taxa-99food'],
        event: 'calculator_result_shown',
        property: 'calculator=99food',
        channel: 'paid',
        device: 'mobile',
        identity: 'identified',
        cursor: `2026-10-05T13:00:00.000Z~${SESSION_ID}`,
      }),
    );

    expect(calls).toEqual([
      [
        PROJECT,
        RANGE,
        {
          paths: ['/calculadora-taxa-ifood', '/calculadora-taxa-99food'],
          event: {
            name: 'calculator_result_shown',
            property: { key: 'calculator', value: '99food' },
          },
          channel: 'paid',
          deviceType: 'mobile',
          identity: 'identified',
        },
        { startedAt: new Date('2026-10-05T13:00:00.000Z'), sessionId: SESSION_ID },
      ],
    ]);
    expect(visitsReportSchema.parse(body)).toEqual({
      visits: [
        {
          session_id: SESSION_ID,
          started_at: '2026-10-05T12:00:00.000Z',
          ended_at: '2026-10-05T12:04:30.000Z',
          entry_path: '/calculator',
          page_views: 3,
          highlights: ['calculator_result_shown', 'signup_completed'],
          failed_requests: 1,
          device_type: 'mobile',
          browser: 'safari',
          os: 'ios',
          country: 'BR',
          channel: 'paid',
          user_id: 'u_7f3a',
        },
      ],
      next_cursor: `2026-10-05T12:00:00.000Z~${SESSION_ID}`,
    });
  });

  it('asks with no filter and answers no cursor on the last page', async () => {
    const { controller, calls } = controllerAnswering({ visits: [], nextCursor: null });

    const body = await controller.visits(
      { project: PROJECT } as FastifyRequest,
      visitsQuerySchema.parse(RANGE),
    );

    expect(calls).toEqual([[PROJECT, RANGE, NO_VISIT_FILTERS, null]]);
    expect(body).toEqual({ visits: [], next_cursor: null });
  });

  it('takes an event without a property, and one page as a single text', async () => {
    const { controller, calls } = controllerAnswering({ visits: [], nextCursor: null });

    await controller.visits(
      { project: PROJECT } as FastifyRequest,
      visitsQuerySchema.parse({ ...RANGE, path: '/pricing', event: 'signup_completed' }),
    );

    expect(calls[0]?.[2]).toEqual({
      ...NO_VISIT_FILTERS,
      paths: ['/pricing'],
      event: { name: 'signup_completed', property: null },
    });
  });
});

describe('visitCursorText', () => {
  it('writes a cursor the query schema reads back', () => {
    const cursor = { startedAt: new Date('2026-10-05T12:00:00.000Z'), sessionId: SESSION_ID };

    expect(visitsQuerySchema.parse({ ...RANGE, cursor: visitCursorText(cursor) }).cursor).toEqual(
      cursor,
    );
  });
});

describe('visitsQuerySchema', () => {
  it.each([
    ['four pages', { path: ['/a', '/b', '/c', '/d'] }],
    ['a page without a leading slash', { path: 'pricing' }],
    ['an event name with spaces', { event: 'signed up' }],
    ['a property without an event', { property: 'calculator=ifood' }],
    ['a property without an equals sign', { event: 'x', property: 'calculator' }],
    ['a property with an empty value', { event: 'x', property: 'calculator=' }],
    ['a property key in upper case', { event: 'x', property: 'Calculator=ifood' }],
    ['a property value over 100 characters', { event: 'x', property: `k=${'v'.repeat(101)}` }],
    ['an unknown channel', { channel: 'tv' }],
    ['an unknown device', { device: 'watch' }],
    ['an unknown identity', { identity: 'someone' }],
    ['a cursor that is not a next_cursor', { cursor: 'yesterday' }],
    ['a cursor with a visit id that is not a UUID', { cursor: '2026-10-05T12:00:00.000Z~v1' }],
    ['an unknown parameter', { sort: 'oldest' }],
  ])('refuses %s', (_case, extra) => {
    expect(visitsQuerySchema.safeParse({ ...RANGE, ...extra }).success).toBe(false);
  });

  it('keeps an equals sign inside a property value', () => {
    expect(
      visitsQuerySchema.parse({ ...RANGE, event: 'x', property: 'formula=a=b' }).property,
    ).toEqual({ key: 'formula', value: 'a=b' });
  });
});

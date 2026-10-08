import type { FastifyRequest } from 'fastify';
import type { Project } from '../../../domain/entities/project.entity';
import type { FunnelSubjectsReport } from '../../../domain/queries/funnel';
import type { GetFunnelSubjectsUseCase } from '../../../usecases/queries/get-funnel-subjects.usecase';
import { FunnelSubjectsController } from './funnel-subjects.controller';
import {
  funnelSubjectCursorText,
  funnelSubjectsQuerySchema,
  funnelSubjectsReportSchema,
} from './funnel-subjects.schemas';

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
const STEPS = JSON.stringify([
  { type: 'page', path: '/pricing' },
  { type: 'event', name: 'signup_completed' },
]);
const BASE = { ...RANGE, mode: 'visit', steps: STEPS };

function controllerAnswering(report: FunnelSubjectsReport) {
  const calls: unknown[][] = [];
  const useCase = {
    execute: (...args: unknown[]) => {
      calls.push(args);
      return Promise.resolve(report);
    },
  };
  return {
    controller: new FunnelSubjectsController(useCase as unknown as GetFunnelSubjectsUseCase),
    calls,
  };
}

describe('FunnelSubjectsController', () => {
  it('asks for the subjects of the step, counted from one, and answers them with a cursor', async () => {
    const lastStepAt = new Date('2026-10-05T12:00:00.000Z');
    const { controller, calls } = controllerAnswering({
      subjects: [{ id: SESSION_ID, lastStepAt }],
      nextCursor: { id: SESSION_ID, lastStepAt },
    });

    const body = await controller.subjects(
      { project: PROJECT } as FastifyRequest,
      funnelSubjectsQuerySchema.parse({
        ...BASE,
        step: '2',
        outcome: 'dropped',
        cursor: `2026-10-05T13:00:00.000Z~${SESSION_ID}`,
      }),
    );

    expect(calls).toEqual([
      [
        PROJECT,
        RANGE,
        {
          mode: 'visit',
          steps: JSON.parse(STEPS) as unknown,
          stepIndex: 1,
          outcome: 'dropped',
        },
        { lastStepAt: new Date('2026-10-05T13:00:00.000Z'), id: SESSION_ID },
      ],
    ]);
    expect(funnelSubjectsReportSchema.parse(body)).toEqual({
      subjects: [{ id: SESSION_ID, last_step_at: '2026-10-05T12:00:00.000Z' }],
      next_cursor: `2026-10-05T12:00:00.000Z~${SESSION_ID}`,
    });
  });

  it('asks without a cursor and answers none on the last page', async () => {
    const { controller, calls } = controllerAnswering({ subjects: [], nextCursor: null });

    const body = await controller.subjects(
      { project: PROJECT } as FastifyRequest,
      funnelSubjectsQuerySchema.parse({ ...BASE, step: '1', outcome: 'reached' }),
    );

    expect(calls[0]?.[3]).toBeNull();
    expect(body).toEqual({ subjects: [], next_cursor: null });
  });
});

describe('funnelSubjectsQuerySchema', () => {
  it.each([
    ['a step past the last one', { step: '3', outcome: 'reached' }],
    ['step zero', { step: '0', outcome: 'reached' }],
    ['a step that is not a number', { step: 'two', outcome: 'reached' }],
    ['dropping at the first step', { step: '1', outcome: 'dropped' }],
    ['an unknown outcome', { step: '1', outcome: 'converted' }],
    [
      'a cursor without a separator',
      { step: '1', outcome: 'reached', cursor: '2026-10-05T12:00:00.000ZZ' },
    ],
    [
      'a cursor with a bad time',
      { step: '1', outcome: 'reached', cursor: `yesterday~${SESSION_ID}` },
    ],
    [
      'a cursor without an id',
      { step: '1', outcome: 'reached', cursor: '2026-10-05T12:00:00.000Z~' },
    ],
  ])('refuses %s', (_case, extra) => {
    expect(funnelSubjectsQuerySchema.safeParse({ ...BASE, ...extra }).success).toBe(false);
  });

  it('reads back the cursor it writes for a person', () => {
    const cursor = { lastStepAt: new Date('2026-10-05T12:00:00.000Z'), id: 'ana' };

    expect(
      funnelSubjectsQuerySchema.parse({
        ...BASE,
        step: '1',
        outcome: 'reached',
        cursor: funnelSubjectCursorText(cursor),
      }).cursor,
    ).toEqual(cursor);
  });
});

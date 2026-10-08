import type { Project } from '../../domain/entities/project.entity';
import { InvalidRangeError } from '../../domain/errors/query.errors';
import {
  FUNNEL_SUBJECTS_PAGE_SIZE,
  type FunnelSubject,
  type FunnelSubjectsAsked,
} from '../../domain/queries/funnel';
import { FixedClock } from '../../test-utils/fixed-clock';
import { StubFunnelQuery } from '../../test-utils/stub-funnel.query';
import { GetFunnelSubjectsUseCase } from './get-funnel-subjects.usecase';

const PROJECT: Project = {
  id: 'project-1',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: 'signup_completed',
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};
const RANGE = { from: '2026-10-01', to: '2026-10-05' };
const ASKED: FunnelSubjectsAsked = {
  mode: 'visit',
  steps: [
    { type: 'page', path: '/calculadora-*' },
    { type: 'event', name: 'signup_completed' },
  ],
  stepIndex: 1,
  outcome: 'dropped',
};

function subject(index: number): FunnelSubject {
  return {
    id: `session-${String(index)}`,
    lastStepAt: new Date(Date.UTC(2026, 9, 5, 12) - index * 60_000),
  };
}

function setup() {
  const query = new StubFunnelQuery();
  const useCase = new GetFunnelSubjectsUseCase(
    query,
    new FixedClock(new Date('2026-10-06T02:30:00.000Z')),
  );
  return { query, useCase };
}

describe('GetFunnelSubjectsUseCase', () => {
  it('asks one subject more than a page and answers no cursor on the last page', async () => {
    const { query, useCase } = setup();
    query.found = [subject(0), subject(1)];

    const report = await useCase.execute(PROJECT, RANGE, ASKED, null);

    expect(report).toEqual({ subjects: [subject(0), subject(1)], nextCursor: null });
    expect(query.subjectCalls).toEqual([
      {
        scope: {
          projectId: 'project-1',
          timeZone: 'America/Sao_Paulo',
          conversionEvent: 'signup_completed',
          range: RANGE,
        },
        asked: ASKED,
        after: null,
        limit: FUNNEL_SUBJECTS_PAGE_SIZE + 1,
      },
    ]);
  });

  it('shows a full page and points the cursor at its last subject when more exist', async () => {
    const { query, useCase } = setup();
    query.found = Array.from({ length: FUNNEL_SUBJECTS_PAGE_SIZE + 1 }, (_, index) =>
      subject(index),
    );
    const after = { lastStepAt: new Date('2026-10-05T13:00:00.000Z'), id: 'session-x' };

    const report = await useCase.execute(PROJECT, RANGE, ASKED, after);

    expect(report.subjects).toHaveLength(FUNNEL_SUBJECTS_PAGE_SIZE);
    expect(report.nextCursor).toEqual(subject(FUNNEL_SUBJECTS_PAGE_SIZE - 1));
    expect(query.subjectCalls[0]?.after).toBe(after);
  });

  it('refuses a range that ends after today in the project time zone', async () => {
    const { query, useCase } = setup();

    await expect(
      useCase.execute(PROJECT, { from: '2026-10-05', to: '2026-10-06' }, ASKED, null),
    ).rejects.toBeInstanceOf(InvalidRangeError);
    expect(query.subjectCalls).toEqual([]);
  });
});

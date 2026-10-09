import type { Project } from '../../domain/entities/project.entity';
import { InvalidRangeError } from '../../domain/errors/query.errors';
import type { FunnelStep } from '../../domain/queries/funnel';
import { FixedClock } from '../../test-utils/fixed-clock';
import { StubFunnelQuery } from '../../test-utils/stub-funnel.query';
import { GetFunnelSegmentsUseCase } from './get-funnel-segments.usecase';

const PROJECT: Project = {
  id: 'project-1',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: 'signup_completed',
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};
const STEPS: readonly FunnelStep[] = [
  { type: 'page', path: '/pricing' },
  { type: 'event', name: 'signup_completed' },
];

function setup() {
  const query = new StubFunnelQuery();
  const useCase = new GetFunnelSegmentsUseCase(
    query,
    new FixedClock(new Date('2026-10-06T02:30:00.000Z')),
  );
  return { query, useCase };
}

describe('GetFunnelSegmentsUseCase', () => {
  it('asks for the segments of the funnel over the range in the project zone', async () => {
    const { query, useCase } = setup();
    query.segmented = [{ segment: 'mobile', counts: [5, 2] }];

    const segments = await useCase.execute(
      PROJECT,
      { from: '2026-09-06', to: '2026-10-05' },
      STEPS,
      'device',
    );

    expect(segments).toEqual([{ segment: 'mobile', counts: [5, 2] }]);
    expect(query.segmentCalls).toEqual([
      {
        scope: {
          projectId: 'project-1',
          timeZone: 'America/Sao_Paulo',
          conversionEvent: 'signup_completed',
          range: { from: '2026-09-06', to: '2026-10-05' },
        },
        steps: STEPS,
        by: 'device',
      },
    ]);
  });

  it('refuses a range that ends after today in the project zone', async () => {
    const { query, useCase } = setup();

    await expect(
      useCase.execute(PROJECT, { from: '2026-10-05', to: '2026-10-06' }, STEPS, 'channel'),
    ).rejects.toBeInstanceOf(InvalidRangeError);
    expect(query.segmentCalls).toEqual([]);
  });
});

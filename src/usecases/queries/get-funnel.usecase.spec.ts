import type { Project } from '../../domain/entities/project.entity';
import { InvalidRangeError } from '../../domain/errors/query.errors';
import type { FunnelStep } from '../../domain/queries/funnel';
import { FixedClock } from '../../test-utils/fixed-clock';
import { StubFunnelQuery } from '../../test-utils/stub-funnel.query';
import { GetFunnelUseCase } from './get-funnel.usecase';

const PROJECT: Project = {
  id: 'project-1',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: 'signup_completed',
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};
const STEPS: readonly FunnelStep[] = [
  { type: 'page', path: '/calculadora-*' },
  { type: 'event', name: 'signup_completed' },
];

function setup() {
  const query = new StubFunnelQuery();
  const useCase = new GetFunnelUseCase(query, new FixedClock(new Date('2026-10-06T02:30:00.000Z')));
  return { query, useCase };
}

describe('GetFunnelUseCase', () => {
  it('counts the steps in the mode asked, over the range in the project zone', async () => {
    const { query, useCase } = setup();
    query.counts = [10, 4];

    const report = await useCase.execute(
      PROJECT,
      { from: '2026-10-01', to: '2026-10-05' },
      'user',
      STEPS,
    );

    expect(report).toEqual({ steps: [{ count: 10 }, { count: 4 }] });
    expect(query.asked).toEqual([
      {
        scope: {
          projectId: 'project-1',
          timeZone: 'America/Sao_Paulo',
          conversionEvent: 'signup_completed',
          range: { from: '2026-10-01', to: '2026-10-05' },
        },
        mode: 'user',
        steps: STEPS,
      },
    ]);
  });

  it('refuses an invalid range', async () => {
    await expect(
      setup().useCase.execute(PROJECT, { from: '2026-10-06', to: '2026-10-06' }, 'visit', STEPS),
    ).rejects.toBeInstanceOf(InvalidRangeError);
  });
});

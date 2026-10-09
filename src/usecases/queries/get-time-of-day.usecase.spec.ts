import type { Project } from '../../domain/entities/project.entity';
import { InvalidRangeError } from '../../domain/errors/query.errors';
import { FixedClock } from '../../test-utils/fixed-clock';
import { StubTimeOfDayQuery } from '../../test-utils/stub-time-of-day.query';
import { GetTimeOfDayUseCase } from './get-time-of-day.usecase';

const PROJECT: Project = {
  id: 'project-1',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: null,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};

function setup() {
  const query = new StubTimeOfDayQuery();
  const useCase = new GetTimeOfDayUseCase(
    query,
    new FixedClock(new Date('2026-10-06T02:30:00.000Z')),
  );
  return { query, run: (from: string, to: string) => useCase.execute(PROJECT, { from, to }) };
}

describe('GetTimeOfDayUseCase', () => {
  it('asks for the visit starts of the range in the project zone, as a week of hours', async () => {
    const { query, run } = setup();
    query.cells = [{ weekday: 1, hour: 9, visits: 4 }];

    const report = await run('2026-09-06', '2026-10-05');

    expect(query.asked).toEqual([
      {
        projectId: 'project-1',
        timeZone: 'America/Sao_Paulo',
        conversionEvent: null,
        range: { from: '2026-09-06', to: '2026-10-05' },
      },
    ]);
    expect(report).toHaveLength(7);
    expect(report[0]?.hours[9]).toBe(4);
  });

  it('refuses a range that ends after today in the project zone', async () => {
    const { query, run } = setup();

    await expect(run('2026-10-05', '2026-10-06')).rejects.toBeInstanceOf(InvalidRangeError);
    expect(query.asked).toEqual([]);
  });
});

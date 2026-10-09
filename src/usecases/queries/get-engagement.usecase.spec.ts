import type { Project } from '../../domain/entities/project.entity';
import { InvalidRangeError } from '../../domain/errors/query.errors';
import { FixedClock } from '../../test-utils/fixed-clock';
import { StubEngagementQuery } from '../../test-utils/stub-engagement.query';
import { GetEngagementUseCase } from './get-engagement.usecase';

const PROJECT: Project = {
  id: 'project-1',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: null,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};

function setup() {
  const query = new StubEngagementQuery();
  const useCase = new GetEngagementUseCase(
    query,
    new FixedClock(new Date('2026-10-06T02:30:00.000Z')),
  );
  return { query, run: (from: string, to: string) => useCase.execute(PROJECT, { from, to }) };
}

describe('GetEngagementUseCase', () => {
  it('reads the four figures of the range in the project zone, the top ten pages each', async () => {
    const { query, run } = setup();
    query.shapeTotals = { visits: 7, singlePageVisits: 3, medianVisitSeconds: 42 };
    query.lengths = [{ bucket: 1, visits: 7 }];
    query.entries = [{ path: '/', visits: 7, singlePageVisits: 3 }];
    query.exits = [{ path: '/pricing', visits: 7 }];

    const report = await run('2026-09-06', '2026-10-05');

    expect(report).toMatchObject({
      visits: 7,
      singlePageVisits: 3,
      medianVisitSeconds: 42,
      entryPages: [{ path: '/', visits: 7, singlePageVisits: 3 }],
      exitPages: [{ path: '/pricing', visits: 7 }],
    });
    expect(report.visitLengths[1]).toEqual({ upToSeconds: 30, visits: 7 });
    expect(query.asked.map((asked) => asked.limit).filter(Boolean)).toEqual([10, 10]);
    expect(query.asked[0]?.scope.range).toEqual({ from: '2026-09-06', to: '2026-10-05' });
  });

  it('refuses a range that ends after today in the project zone', async () => {
    const { query, run } = setup();

    await expect(run('2026-10-05', '2026-10-06')).rejects.toBeInstanceOf(InvalidRangeError);
    expect(query.asked).toEqual([]);
  });
});

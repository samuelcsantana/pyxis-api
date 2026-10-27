import type { Project } from '../../domain/entities/project.entity';
import { InvalidRangeError } from '../../domain/errors/query.errors';
import { FixedClock } from '../../test-utils/fixed-clock';
import { StubArrivalsQuery } from '../../test-utils/stub-arrivals.query';
import { GetArrivalsUseCase } from './get-arrivals.usecase';
import { NO_REPORT_FILTERS } from '../../domain/queries/report-filters';

const NOW = new Date('2026-10-23T17:05:12.000Z');
const PROJECT: Project = {
  id: 'project-1',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: null,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};

function setup() {
  const query = new StubArrivalsQuery();
  const useCase = new GetArrivalsUseCase(query, new FixedClock(NOW));
  return { query, useCase };
}

describe('GetArrivalsUseCase', () => {
  it('asks what arrived since the moment, inside the range in the project zone', async () => {
    const { query, useCase } = setup();
    query.rows = {
      visits: [new Date('2026-10-23T17:04:58.200Z')],
      conversions: null,
      namedEvents: [],
      failedRequests: [],
      activeVisits: 2,
    };

    const report = await useCase.execute(
      PROJECT,
      { from: '2026-10-17', to: '2026-10-23' },
      new Date('2026-10-23T17:00:00.000Z'),
    );

    expect(query.asked).toEqual([
      {
        scope: {
          projectId: 'project-1',
          timeZone: 'America/Sao_Paulo',
          conversionEvent: null,
          range: { from: '2026-10-17', to: '2026-10-23' },
          filters: NO_REPORT_FILTERS,
        },
        since: new Date('2026-10-23T17:00:00.000Z'),
        activeSince: new Date('2026-10-23T17:00:12.000Z'),
        limit: 101,
      },
    ]);
    expect(report).toEqual({
      asOf: NOW,
      activeVisits: 2,
      visits: { times: [new Date('2026-10-23T17:04:59.000Z')], more: false },
      conversions: null,
      namedEvents: { times: [], more: false },
      failedRequests: { times: [], more: false },
    });
  });

  it('refuses a range that ends after today, like every report', async () => {
    const { query, useCase } = setup();

    await expect(
      useCase.execute(PROJECT, { from: '2026-10-23', to: '2026-10-24' }, NOW),
    ).rejects.toBeInstanceOf(InvalidRangeError);
    expect(query.asked).toEqual([]);
  });
});

import type { Project } from '../../domain/entities/project.entity';
import { InvalidRangeError } from '../../domain/errors/query.errors';
import { TOP_SUMMARY_GROUPS } from '../../domain/queries/property-summary';
import { FixedClock } from '../../test-utils/fixed-clock';
import { StubPropertySummaryQuery } from '../../test-utils/stub-property-summary.query';
import { GetPropertySummaryUseCase } from './get-property-summary.usecase';

const PROJECT: Project = {
  id: 'project-1',
  name: 'Blog',
  allowedOrigins: ['https://blog.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: null,
  cityEnabled: false,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};
const CLOCK = new FixedClock(new Date('2026-10-06T02:30:00.000Z'));
const RANGE = { from: '2026-10-04', to: '2026-10-05' };
const REQUEST = { name: 'article_read_100', key: 'seconds', by: 'post' };

describe('GetPropertySummaryUseCase', () => {
  it('asks the summary of one property in the scoped range, with the top groups', async () => {
    const query = new StubPropertySummaryQuery();
    query.answer = {
      overall: { events: 3, median: 30, p25: 20, p75: 40 },
      groups: [{ value: 'one-post', events: 2, median: 25, p25: 20, p75: 30 }],
      groupedEvents: 3,
    };

    const report = await new GetPropertySummaryUseCase(query, CLOCK).execute(
      PROJECT,
      RANGE,
      REQUEST,
    );

    expect(report).toEqual({
      ...REQUEST,
      overall: { events: 3, median: 30, p25: 20, p75: 40 },
      groups: [{ value: 'one-post', events: 2, median: 25, p25: 20, p75: 30 }],
      otherCount: 1,
    });
    expect(query.asked.map(({ request, groups }) => ({ request, groups }))).toEqual([
      { request: REQUEST, groups: TOP_SUMMARY_GROUPS },
    ]);
    expect(query.asked[0]?.scope.range).toEqual(RANGE);
    expect(query.asked[0]?.scope.timeZone).toBe('America/Sao_Paulo');
  });

  it('refuses an invalid range', async () => {
    await expect(
      new GetPropertySummaryUseCase(new StubPropertySummaryQuery(), CLOCK).execute(
        PROJECT,
        { from: '2026-10-05', to: '2026-10-04' },
        REQUEST,
      ),
    ).rejects.toBeInstanceOf(InvalidRangeError);
  });
});

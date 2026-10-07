import type { Project } from '../../domain/entities/project.entity';
import { InvalidRangeError } from '../../domain/errors/query.errors';
import { TOP_PROPERTY_VALUES } from '../../domain/queries/property-breakdown';
import { FixedClock } from '../../test-utils/fixed-clock';
import { StubPropertyBreakdownQuery } from '../../test-utils/stub-property-breakdown.query';
import { GetPropertyBreakdownUseCase } from './get-property-breakdown.usecase';

const PROJECT: Project = {
  id: 'project-1',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: 'signup_completed',
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};
const CLOCK = new FixedClock(new Date('2026-10-06T02:30:00.000Z'));
const RANGE = { from: '2026-10-04', to: '2026-10-05' };

describe('GetPropertyBreakdownUseCase', () => {
  it('asks the top values of one event in the scoped range and groups them by key', async () => {
    const query = new StubPropertyBreakdownQuery();
    query.answer = {
      events: 5,
      values: [
        { key: 'calculator', value: 'ifood', count: 3, visits: 2, keyEvents: 5 },
        { key: 'calculator', value: '99food', count: 2, visits: 2, keyEvents: 5 },
      ],
    };

    const report = await new GetPropertyBreakdownUseCase(query, CLOCK).execute(
      PROJECT,
      RANGE,
      'calculator_result_shown',
    );

    expect(report).toEqual({
      name: 'calculator_result_shown',
      events: 5,
      keys: [
        {
          key: 'calculator',
          events: 5,
          values: [
            { value: 'ifood', count: 3, visits: 2 },
            { value: '99food', count: 2, visits: 2 },
          ],
          otherCount: 0,
        },
      ],
    });
    expect(query.asked.map(({ name, limit }) => ({ name, limit }))).toEqual([
      { name: 'calculator_result_shown', limit: TOP_PROPERTY_VALUES },
    ]);
    expect(query.asked[0]?.scope.range).toEqual(RANGE);
    expect(query.asked[0]?.scope.timeZone).toBe('America/Sao_Paulo');
  });

  it('refuses an invalid range', async () => {
    await expect(
      new GetPropertyBreakdownUseCase(new StubPropertyBreakdownQuery(), CLOCK).execute(
        PROJECT,
        { from: '2026-10-06', to: '2026-10-06' },
        'calculator_result_shown',
      ),
    ).rejects.toBeInstanceOf(InvalidRangeError);
  });
});

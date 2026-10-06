import type { Project } from '../../domain/entities/project.entity';
import { InvalidRangeError } from '../../domain/errors/query.errors';
import { FixedClock } from '../../test-utils/fixed-clock';
import { StubDevicesQuery } from '../../test-utils/stub-devices.query';
import { GetDevicesUseCase } from './get-devices.usecase';

const PROJECT: Project = {
  id: 'project-1',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: 'signup_completed',
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};

function setup(project: Project = PROJECT) {
  const query = new StubDevicesQuery();
  const useCase = new GetDevicesUseCase(
    query,
    new FixedClock(new Date('2026-10-06T02:30:00.000Z')),
  );
  return { query, run: (from: string, to: string) => useCase.execute(project, { from, to }) };
}

describe('GetDevicesUseCase', () => {
  it('asks each dimension for the range in the project zone and ranks the values', async () => {
    const { query, run } = setup();
    query.counts.set('deviceType', [
      { value: 'desktop', visits: 2, conversions: 0 },
      { value: 'mobile', visits: 5, conversions: 1 },
    ]);
    query.counts.set('country', [{ value: null, visits: 1, conversions: 0 }]);

    const report = await run('2026-09-06', '2026-10-05');

    expect(report.deviceType).toEqual([
      { value: 'mobile', visits: 5, conversions: 1 },
      { value: 'desktop', visits: 2, conversions: 0 },
    ]);
    expect(report.browser).toEqual([]);
    expect(report.country).toEqual([{ value: 'other', visits: 1, conversions: 0 }]);
    expect(query.asked.map((asked) => asked.dimension)).toEqual([
      'deviceType',
      'browser',
      'os',
      'country',
    ]);
    expect(query.asked[0]?.scope.range).toEqual({ from: '2026-09-06', to: '2026-10-05' });
  });

  it('answers null conversions without a conversion event', async () => {
    const { query, run } = setup({ ...PROJECT, conversionEvent: null });
    query.counts.set('os', [{ value: 'ios', visits: 3, conversions: 0 }]);

    expect((await run('2026-10-05', '2026-10-05')).os).toEqual([
      { value: 'ios', visits: 3, conversions: null },
    ]);
  });

  it('refuses an invalid range', async () => {
    await expect(setup().run('2026-10-05', '2026-10-01')).rejects.toBeInstanceOf(InvalidRangeError);
  });
});

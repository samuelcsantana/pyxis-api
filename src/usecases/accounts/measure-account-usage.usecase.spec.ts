import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAccountUsageRepository } from '../../test-utils/in-memory-account-usage.repository';
import { MeasureAccountUsageUseCase } from './measure-account-usage.usecase';

const NOW = new Date('2026-10-14T03:00:00.000Z');
const OVER = 'acc00000-0000-4000-a000-000000000001';
const UNDER = 'acc00000-0000-4000-a000-000000000002';
const FREE = 'acc00000-0000-4000-a000-000000000003';

describe('MeasureAccountUsageUseCase', () => {
  it('records the month so far for every account and pauses only paid ones past 150%', async () => {
    const usage = new InMemoryAccountUsageRepository();
    usage.measured = [
      { accountId: OVER, status: 'active', events: 160_000 },
      { accountId: UNDER, status: 'trialing', events: 90_000 },
      { accountId: FREE, status: 'comped', events: 400_000 },
    ];

    const report = await new MeasureAccountUsageUseCase(usage, new FixedClock(NOW)).execute();

    expect(report).toEqual({ month: '2026-10', accounts: 3, paused: 1 });
    expect(usage.windows).toEqual([
      { from: new Date('2026-10-01T00:00:00.000Z'), to: new Date('2026-11-01T00:00:00.000Z') },
    ]);
    expect(usage.pauseOf(OVER)).toEqual(new Date('2026-11-01T00:00:00.000Z'));
    expect(usage.pauseOf(UNDER)).toBeNull();
    expect(usage.pauseOf(FREE)).toBeNull();
    expect(await usage.recordedFor(UNDER, '2026-10')).toEqual({
      month: '2026-10',
      events: 90_000,
      updatedAt: NOW,
    });
    expect(await usage.recordedFor(UNDER, '2026-09')).toBeNull();
  });

  it('reports nothing measured when there is no account', async () => {
    const usage = new InMemoryAccountUsageRepository();

    const report = await new MeasureAccountUsageUseCase(usage, new FixedClock(NOW)).execute();

    expect(report).toEqual({ month: '2026-10', accounts: 0, paused: 0 });
  });
});

import type { Project } from '../../domain/entities/project.entity';
import { InvalidRangeError } from '../../domain/errors/query.errors';
import { TOP_FEATURES } from '../../domain/queries/features';
import { RECENT_FAILURES_PER_ROUTE, TOP_ROUTES } from '../../domain/queries/requests';
import { FixedClock } from '../../test-utils/fixed-clock';
import { StubFeaturesQuery } from '../../test-utils/stub-features.query';
import { StubRequestsQuery } from '../../test-utils/stub-requests.query';
import { GetFeaturesUseCase } from './get-features.usecase';
import { GetRequestsUseCase } from './get-requests.usecase';

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
const KEY = { method: 'POST', route: '/v1/plans' };

describe('GetFeaturesUseCase', () => {
  it('ranks the features, then asks the days of the ranked ones only', async () => {
    const query = new StubFeaturesQuery();
    query.totalsAnswer = [{ name: 'plan_selected', count: 3, visits: 2 }];
    query.daysAnswer = [{ name: 'plan_selected', date: '2026-10-05', count: 3 }];

    const report = await new GetFeaturesUseCase(query, CLOCK).execute(PROJECT, RANGE, 'events');

    expect(report.items).toEqual([{ name: 'plan_selected', count: 3, visits: 2, daily: [0, 3] }]);
    expect(query.asked).toEqual([
      { method: 'totals', kind: 'events', extra: TOP_FEATURES },
      { method: 'days', kind: 'events', extra: ['plan_selected'] },
    ]);
    expect(query.scopes[0]?.range).toEqual(RANGE);
  });

  it('skips the days when nothing happened', async () => {
    const query = new StubFeaturesQuery();

    const report = await new GetFeaturesUseCase(query, CLOCK).execute(PROJECT, RANGE, 'screens');

    expect(report.items).toEqual([]);
    expect(query.asked.map((asked) => asked.method)).toEqual(['totals']);
  });

  it('refuses an invalid range', async () => {
    await expect(
      new GetFeaturesUseCase(new StubFeaturesQuery(), CLOCK).execute(
        PROJECT,
        { from: '2026-10-06', to: '2026-10-06' },
        'events',
      ),
    ).rejects.toBeInstanceOf(InvalidRangeError);
  });
});

describe('GetRequestsUseCase', () => {
  it('puts the statuses, screens and recent failures of each route under it', async () => {
    const query = new StubRequestsQuery();
    const failedAt = new Date('2026-10-05T12:00:00.000Z');
    query.routesAnswer = [{ ...KEY, total: 4, failed: 1, medianDurationMs: 80 }];
    query.statusesAnswer = [
      { ...KEY, status: 201, count: 3 },
      { ...KEY, status: 500, count: 1 },
      { method: 'PUT', route: '/v1/plans', status: 200, count: 9 },
    ];
    query.screensAnswer = [{ ...KEY, path: '/pricing', failed: 1 }];
    query.failuresAnswer = [
      { ...KEY, occurredAt: failedAt, status: 500, errorCode: 'card_declined', sessionId: 's1' },
    ];

    const report = await new GetRequestsUseCase(query, CLOCK).execute(
      PROJECT,
      RANGE,
      '/pricing',
      'writes',
    );

    expect(report.kind).toBe('writes');
    expect(report.routes).toEqual([
      {
        ...KEY,
        total: 4,
        failed: 1,
        medianDurationMs: 80,
        statuses: [
          { status: 201, count: 3 },
          { status: 500, count: 1 },
        ],
        screens: [{ path: '/pricing', failed: 1 }],
        recentFailures: [
          { occurredAt: failedAt, status: 500, errorCode: 'card_declined', sessionId: 's1' },
        ],
      },
    ]);
    expect(query.scopes.every((scope) => scope.screen === '/pricing')).toBe(true);
    expect(query.sizes).toEqual([TOP_ROUTES, RECENT_FAILURES_PER_ROUTE]);
  });

  it('asks for every screen when none is chosen', async () => {
    const query = new StubRequestsQuery();

    await new GetRequestsUseCase(query, CLOCK).execute(PROJECT, RANGE, null, 'writes');

    expect(query.scopes[0]?.screen).toBeNull();
  });

  it('asks for the failed reads when they are the kind wanted', async () => {
    const query = new StubRequestsQuery();

    const report = await new GetRequestsUseCase(query, CLOCK).execute(
      PROJECT,
      RANGE,
      null,
      'reads',
    );

    expect(report.kind).toBe('reads');
    expect(query.scopes.every((scope) => scope.kind === 'reads')).toBe(true);
  });
});

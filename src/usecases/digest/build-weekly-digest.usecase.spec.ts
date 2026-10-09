import type { Project } from '../../domain/entities/project.entity';
import type { DayTotals } from '../../domain/queries/overview';
import { StubOverviewQuery } from '../../test-utils/stub-overview.query';
import { StubProjectActivityQuery } from '../../test-utils/stub-project-activity.query';
import { StubRequestsQuery } from '../../test-utils/stub-requests.query';
import { BuildWeeklyDigestUseCase } from './build-weekly-digest.usecase';

const SHOP: Project = {
  id: 'shop',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: 'signup_completed',
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};
const WEEK = { from: '2026-10-05', to: '2026-10-11' };
const LAST_EVENT_AT = new Date('2026-10-11T22:10:00.000Z');

function day(date: string, visits: number): DayTotals {
  return {
    date,
    visits,
    identifiedUsers: 0,
    conversions: 0,
    convertingVisits: 0,
    writes: 0,
    failedWrites: 0,
    pageViews: visits,
    events: visits,
  };
}

function setup() {
  const overview = new StubOverviewQuery();
  const requests = new StubRequestsQuery();
  const activity = new StubProjectActivityQuery();
  return {
    overview,
    requests,
    activity,
    build: new BuildWeeklyDigestUseCase(overview, requests, activity),
  };
}

describe('BuildWeeklyDigestUseCase', () => {
  it('compares the week with the one before and lists its days, pages, events and failures', async () => {
    const { overview, requests, activity, build } = setup();
    overview.totalsByFrom.set('2026-10-05', {
      visits: 812,
      identifiedUsers: 120,
      conversions: 50,
      convertingVisits: 41,
      writes: 1204,
      failedWrites: 3,
    });
    overview.totalsByFrom.set('2026-09-28', {
      visits: 725,
      identifiedUsers: 101,
      conversions: 44,
      convertingVisits: 38,
      writes: 1100,
      failedWrites: 5,
    });
    overview.sparseDays = [day('2026-10-05', 130), day('2026-10-09', 90), day('2026-10-12', 7)];
    overview.pages = [{ path: '/', views: 600, visits: 500 }];
    overview.namedEvents = [{ name: 'signup_completed', count: 50, visits: 41 }];
    requests.routesAnswer = [
      {
        method: 'POST',
        route: '/orders',
        total: 340,
        failed: 2,
        medianDurationMs: 120,
        p95DurationMs: 400,
      },
      {
        method: 'PUT',
        route: '/profile',
        total: 20,
        failed: 0,
        medianDurationMs: 80,
        p95DurationMs: 90,
      },
    ];
    activity.activity.set(SHOP.id, { firstEventAt: null, lastEventAt: LAST_EVENT_AT });

    const digest = await build.execute(SHOP, WEEK);

    expect(digest).toEqual({
      projectId: 'shop',
      projectName: 'Shop',
      timeZone: 'America/Sao_Paulo',
      week: WEEK,
      visits: { current: 812, previous: 725 },
      identifiedUsers: { current: 120, previous: 101 },
      convertingVisits: { current: 41, previous: 38 },
      failedWrites: { current: { failed: 3, total: 1204 }, previous: { failed: 5, total: 1100 } },
      days: [
        { date: '2026-10-05', visits: 130 },
        { date: '2026-10-06', visits: 0 },
        { date: '2026-10-07', visits: 0 },
        { date: '2026-10-08', visits: 0 },
        { date: '2026-10-09', visits: 90 },
        { date: '2026-10-10', visits: 0 },
        { date: '2026-10-11', visits: 0 },
      ],
      topPages: [{ path: '/', views: 600, visits: 500 }],
      topEvents: [{ name: 'signup_completed', count: 50, visits: 41 }],
      failingRoutes: [{ method: 'POST', route: '/orders', failed: 2, total: 340 }],
      lastEventAt: LAST_EVENT_AT,
    });
  });

  it('asks every query for the week in the project time zone, and five items at most', async () => {
    const { overview, requests, activity, build } = setup();

    await build.execute(SHOP, WEEK);

    expect(overview.scopes.map((scope) => scope.range)).toEqual([
      WEEK,
      { from: '2026-09-28', to: '2026-10-04' },
      WEEK,
      WEEK,
      WEEK,
    ]);
    expect(overview.scopes.every((scope) => scope.timeZone === 'America/Sao_Paulo')).toBe(true);
    expect(overview.limits).toEqual([5, 5]);
    expect(requests.scopes).toEqual([
      {
        projectId: 'shop',
        timeZone: 'America/Sao_Paulo',
        conversionEvent: 'signup_completed',
        range: WEEK,
        screen: null,
        kind: 'writes',
      },
    ]);
    expect(requests.sizes).toEqual([3]);
    expect(activity.asked).toEqual([['shop']]);
  });

  it('leaves conversions out of a project without a conversion event', async () => {
    const { build } = setup();

    const digest = await build.execute({ ...SHOP, conversionEvent: null }, WEEK);

    expect(digest.convertingVisits).toBeNull();
  });

  it('says when no event ever arrived', async () => {
    const { build } = setup();

    const digest = await build.execute(SHOP, WEEK);

    expect(digest.visits).toEqual({ current: 0, previous: 0 });
    expect(digest.lastEventAt).toBeNull();
    expect(digest.failingRoutes).toEqual([]);
  });
});

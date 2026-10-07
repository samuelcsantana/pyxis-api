import type { Project } from '../../domain/entities/project.entity';
import { InvalidRangeError } from '../../domain/errors/query.errors';
import { TOP_ITEMS } from '../../domain/queries/overview';
import { FixedClock } from '../../test-utils/fixed-clock';
import { StubOverviewQuery } from '../../test-utils/stub-overview.query';
import { GetOverviewUseCase } from './get-overview.usecase';

const PROJECT: Project = {
  id: 'project-1',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: 'signup_completed',
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};
const LATE_EVENING_IN_SAO_PAULO = new Date('2026-10-06T02:30:00.000Z');

function setup(project: Project = PROJECT, now: Date = LATE_EVENING_IN_SAO_PAULO) {
  const query = new StubOverviewQuery();
  const useCase = new GetOverviewUseCase(query, new FixedClock(now));
  return { query, run: (from: string, to: string) => useCase.execute(project, { from, to }) };
}

function scopesFrom(query: StubOverviewQuery, from: string) {
  return query.scopes.filter((scope) => scope.range.from === from);
}

describe('GetOverviewUseCase', () => {
  it('compares the range with the same number of days right before it', async () => {
    const { query, run } = setup();
    query.totalsByFrom.set('2026-10-03', {
      visits: 12,
      identifiedUsers: 4,
      conversions: 3,
      convertingVisits: 2,
      writes: 10,
      failedWrites: 1,
    });
    query.totalsByFrom.set('2026-09-30', {
      visits: 9,
      identifiedUsers: 3,
      conversions: 1,
      convertingVisits: 1,
      writes: 8,
      failedWrites: 0,
    });

    const report = await run('2026-10-03', '2026-10-05');

    expect(report.kpis.visits).toMatchObject({ current: 12, previous: 9 });
    expect(report.kpis.identifiedUsers).toMatchObject({ current: 4, previous: 3 });
    expect(report.kpis.conversions).toMatchObject({ current: 3, previous: 1 });
    expect(report.kpis.convertingVisits).toMatchObject({ current: 2, previous: 1 });
    expect(report.kpis.writeErrors).toMatchObject({
      current: { failed: 1, total: 10 },
      previous: { failed: 0, total: 8 },
    });
    expect(query.scopes.map((scope) => scope.range)).toContainEqual({
      from: '2026-09-30',
      to: '2026-10-02',
    });
  });

  it('gives one entry per day, with zeros on days without events', async () => {
    const { query, run } = setup();
    query.sparseDays = [
      {
        date: '2026-10-04',
        visits: 5,
        identifiedUsers: 2,
        conversions: 1,
        convertingVisits: 1,
        writes: 3,
        failedWrites: 1,
        pageViews: 20,
        events: 7,
      },
    ];

    const report = await run('2026-10-03', '2026-10-05');

    expect(report.kpis.visits.daily).toEqual([0, 5, 0]);
    expect(report.kpis.conversions?.daily).toEqual([0, 1, 0]);
    expect(report.kpis.convertingVisits?.daily).toEqual([0, 1, 0]);
    expect(report.kpis.writeErrors.daily).toEqual([
      { failed: 0, total: 0 },
      { failed: 1, total: 3 },
      { failed: 0, total: 0 },
    ]);
    expect(report.days).toEqual([
      { date: '2026-10-03', pageViews: 0, events: 0 },
      { date: '2026-10-04', pageViews: 20, events: 7 },
      { date: '2026-10-05', pageViews: 0, events: 0 },
    ]);
  });

  it('hands the project zone, its conversion event and the top limit to the query', async () => {
    const { query, run } = setup();
    query.pages = [{ path: '/pricing', views: 3, visits: 2 }];
    query.namedEvents = [{ name: 'plan_selected', count: 2, visits: 2 }];

    const report = await run('2026-10-05', '2026-10-05');

    expect(report.topPages).toEqual(query.pages);
    expect(report.topEvents).toEqual(query.namedEvents);
    expect(query.limits).toEqual([TOP_ITEMS, TOP_ITEMS]);
    expect(query.scopes[0]).toEqual({
      projectId: 'project-1',
      timeZone: 'America/Sao_Paulo',
      conversionEvent: 'signup_completed',
      range: { from: '2026-10-05', to: '2026-10-05' },
    });
  });

  it('leaves conversions out when the project has no conversion event', async () => {
    const { run } = setup({ ...PROJECT, conversionEvent: null });

    const { kpis } = await run('2026-10-05', '2026-10-05');

    expect(kpis.conversions).toBeNull();
    expect(kpis.convertingVisits).toBeNull();
  });

  it('stops the previous period at the local time of now when the range ends today', async () => {
    const { query, run } = setup();

    const report = await run('2026-10-03', '2026-10-05');

    expect(report.comparisonCutoff).toBe('23:30:00.000');
    expect(scopesFrom(query, '2026-09-30')).toHaveLength(2);
    for (const scope of scopesFrom(query, '2026-09-30')) {
      expect(scope).toMatchObject({
        range: { from: '2026-09-30', to: '2026-10-02' },
        lastDayUntil: '23:30:00.000',
      });
    }
    for (const scope of scopesFrom(query, '2026-10-03')) {
      expect(scope.lastDayUntil).toBeUndefined();
    }
  });

  it('compares whole days when the range ended before today', async () => {
    const { query, run } = setup();

    const report = await run('2026-10-03', '2026-10-04');

    expect(report.comparisonCutoff).toBeNull();
    expect(query.scopes.every((scope) => scope.lastDayUntil === undefined)).toBe(true);
  });

  it.each([
    ['the last millisecond of the day', '2026-10-06T02:59:59.999Z', '2026-10-05', '23:59:59.999'],
    ['the first moment of the next day', '2026-10-06T03:00:00.007Z', '2026-10-05', null],
    ['the new day', '2026-10-06T03:00:00.007Z', '2026-10-06', '00:00:00.007'],
  ])('reads the cutoff across midnight in Sao Paulo: %s', async (_case, now, day, cutoff) => {
    const { run } = setup(PROJECT, new Date(now));

    expect((await run(day, day)).comparisonCutoff).toBe(cutoff);
  });

  it('reads the cutoff on the UTC clock for a UTC project', async () => {
    const { run } = setup({ ...PROJECT, timezone: 'UTC' });

    expect((await run('2026-10-06', '2026-10-06')).comparisonCutoff).toBe('02:30:00.000');
    expect((await run('2026-10-05', '2026-10-05')).comparisonCutoff).toBeNull();
  });

  it('gives the previous period one entry per day, with zeros on days without events', async () => {
    const { query, run } = setup();
    query.sparseDays = [
      {
        date: '2026-10-03',
        visits: 4,
        identifiedUsers: 1,
        conversions: 2,
        convertingVisits: 2,
        writes: 5,
        failedWrites: 1,
        pageViews: 9,
        events: 3,
      },
    ];

    const report = await run('2026-10-04', '2026-10-05');

    expect(report.previousDays).toEqual([
      {
        date: '2026-10-02',
        pageViews: 0,
        events: 0,
        visits: 0,
        identifiedUsers: 0,
        conversions: 0,
        convertingVisits: 0,
        writeErrors: { failed: 0, total: 0 },
      },
      {
        date: '2026-10-03',
        pageViews: 9,
        events: 3,
        visits: 4,
        identifiedUsers: 1,
        conversions: 2,
        convertingVisits: 2,
        writeErrors: { failed: 1, total: 5 },
      },
    ]);
    expect(report.kpis.visits.daily).toEqual([0, 0]);
  });

  it('leaves the previous days without conversions when the project has no conversion event', async () => {
    const { run } = setup({ ...PROJECT, conversionEvent: null });

    const report = await run('2026-10-05', '2026-10-05');

    expect(report.previousDays).toEqual([
      expect.objectContaining({ date: '2026-10-04', conversions: null, convertingVisits: null }),
    ]);
  });

  it('refuses a range that ends after today in the project zone, even if UTC is already there', async () => {
    const { run } = setup();

    await expect(run('2026-10-06', '2026-10-06')).rejects.toBeInstanceOf(InvalidRangeError);
  });
});

import type { AlertKind } from '../../domain/alerts/project-alert';
import type { Project } from '../../domain/entities/project.entity';
import type { OverviewQuery, PeriodTotals } from '../../domain/queries/overview';
import type { QueryScope } from '../../domain/queries/query-scope';
import { InMemoryGoalRepository } from '../../test-utils/in-memory-goal.repository';
import { StubProjectActivityQuery } from '../../test-utils/stub-project-activity.query';
import { DetectProjectAlertsUseCase } from './detect-project-alerts.usecase';

const NOW = new Date('2026-11-05T06:00:00.000Z');
const PROJECT: Project = {
  id: '6f1d3c2a-8b4e-4f7a-9c1d-2e3f4a5b6c7d',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: 'purchase',
  currency: 'BRL',
  cityEnabled: false,
  visitorsEnabled: false,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};
const NOTHING: PeriodTotals = {
  visits: 0,
  identifiedUsers: 0,
  conversions: 0,
  convertingVisits: 0,
  writes: 0,
  failedWrites: 0,
};
const YESTERDAY = '2026-11-04:2026-11-04';
const WEEK_BEFORE_YESTERDAY = '2026-10-28:2026-11-03';
const SAME_WEEKDAY_BEFORE = '2026-10-28:2026-10-28';
const LAST_SEVEN_DAYS = '2026-10-29:2026-11-04';
const ALL_KINDS: ReadonlySet<AlertKind> = new Set([
  'no_events',
  'failed_writes',
  'conversion_drop',
]);

function setup(totals: Readonly<Record<string, Partial<PeriodTotals>>>) {
  const scopes: QueryScope[] = [];
  const overview = {
    totals: (scope: QueryScope) => {
      scopes.push(scope);
      return Promise.resolve({
        ...NOTHING,
        ...totals[`${scope.range.from}:${scope.range.to}`],
      });
    },
  } as unknown as OverviewQuery;
  const activity = new StubProjectActivityQuery();
  const goals = new InMemoryGoalRepository();
  return {
    scopes,
    activity,
    goals,
    detect: new DetectProjectAlertsUseCase(overview, activity, goals),
  };
}

describe('DetectProjectAlertsUseCase', () => {
  it('raises nothing for a quiet, healthy project', async () => {
    const { detect, activity } = setup({});
    activity.activity.set(PROJECT.id, { firstEventAt: null, lastEventAt: NOW });

    await expect(detect.execute(PROJECT, ALL_KINDS, NOW)).resolves.toEqual([]);
  });

  it('raises no events after 24 hours of silence that follow real traffic', async () => {
    const { detect, activity } = setup({ [LAST_SEVEN_DAYS]: { visits: 140 } });
    const lastEventAt = new Date('2026-11-04T05:30:00.000Z');
    activity.activity.set(PROJECT.id, { firstEventAt: null, lastEventAt });

    await expect(detect.execute(PROJECT, new Set(['no_events']), NOW)).resolves.toEqual([
      {
        kind: 'no_events',
        projectId: PROJECT.id,
        projectName: 'Shop',
        timeZone: 'America/Sao_Paulo',
        lastEventAt,
        visitsBefore: 140,
      },
    ]);
  });

  it('raises nothing for a project the activity query does not know', async () => {
    const { detect } = setup({ [LAST_SEVEN_DAYS]: { visits: 140 } });

    await expect(detect.execute(PROJECT, new Set(['no_events']), NOW)).resolves.toEqual([]);
  });

  it('raises failed writes for a spike yesterday against the week before', async () => {
    const { detect, scopes } = setup({
      [YESTERDAY]: { writes: 40, failedWrites: 12 },
      [WEEK_BEFORE_YESTERDAY]: { writes: 300, failedWrites: 6 },
    });

    await expect(detect.execute(PROJECT, new Set(['failed_writes']), NOW)).resolves.toEqual([
      {
        kind: 'failed_writes',
        projectId: PROJECT.id,
        projectName: 'Shop',
        timeZone: 'America/Sao_Paulo',
        day: '2026-11-04',
        failed: 12,
        total: 40,
        usualRate: 0.02,
      },
    ]);
    expect(scopes.every((scope) => scope.conversion === null)).toBe(true);
  });

  it('raises nothing when yesterday failed as often as usual', async () => {
    const { detect } = setup({
      [YESTERDAY]: { writes: 40, failedWrites: 12 },
      [WEEK_BEFORE_YESTERDAY]: { writes: 300, failedWrites: 90 },
    });

    await expect(detect.execute(PROJECT, new Set(['failed_writes']), NOW)).resolves.toEqual([]);
  });

  it('raises a conversion drop of the first goal against the same weekday a week before', async () => {
    const { detect, goals, scopes } = setup({
      [YESTERDAY]: { conversions: 4 },
      [SAME_WEEKDAY_BEFORE]: { conversions: 12 },
    });
    await goals.create(
      PROJECT.id,
      { name: 'Purchase', target: { type: 'event', name: 'purchase' } },
      10,
    );
    await goals.create(
      PROJECT.id,
      { name: 'Thanks', target: { type: 'page', path: '/thanks' } },
      10,
    );

    await expect(detect.execute(PROJECT, new Set(['conversion_drop']), NOW)).resolves.toEqual([
      {
        kind: 'conversion_drop',
        projectId: PROJECT.id,
        projectName: 'Shop',
        timeZone: 'America/Sao_Paulo',
        goalName: 'Purchase',
        day: '2026-11-04',
        conversions: 4,
        comparedDay: '2026-10-28',
        comparedConversions: 12,
      },
    ]);
    expect(scopes.map((scope) => scope.conversion)).toEqual([
      { type: 'event', name: 'purchase' },
      { type: 'event', name: 'purchase' },
    ]);
  });

  it('raises no conversion drop for a project without a goal', async () => {
    const { detect } = setup({
      [YESTERDAY]: { conversions: 0 },
      [SAME_WEEKDAY_BEFORE]: { conversions: 50 },
    });

    await expect(detect.execute(PROJECT, new Set(['conversion_drop']), NOW)).resolves.toEqual([]);
  });

  it('raises no conversion drop when the goal held up', async () => {
    const { detect, goals } = setup({
      [YESTERDAY]: { conversions: 9 },
      [SAME_WEEKDAY_BEFORE]: { conversions: 12 },
    });
    await goals.create(
      PROJECT.id,
      { name: 'Purchase', target: { type: 'event', name: 'purchase' } },
      10,
    );

    await expect(detect.execute(PROJECT, new Set(['conversion_drop']), NOW)).resolves.toEqual([]);
  });

  it('reads each range once and only what the asked kinds need', async () => {
    const { detect, scopes, activity, goals } = setup({});
    await goals.create(
      PROJECT.id,
      { name: 'Purchase', target: { type: 'event', name: 'purchase' } },
      10,
    );

    await detect.execute(PROJECT, new Set(['failed_writes', 'conversion_drop']), NOW);

    expect(scopes.map((scope) => `${scope.range.from}:${scope.range.to}`)).toEqual([
      YESTERDAY,
      WEEK_BEFORE_YESTERDAY,
      SAME_WEEKDAY_BEFORE,
    ]);
    expect(activity.asked).toEqual([]);
  });

  it('reads nothing when no kind is asked', async () => {
    const { detect, scopes } = setup({});

    await expect(detect.execute(PROJECT, new Set(), NOW)).resolves.toEqual([]);
    expect(scopes).toEqual([]);
  });
});

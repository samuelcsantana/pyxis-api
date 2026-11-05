import { CHANNELS } from '../../domain/entities/tracked-event.entity';
import type { Project } from '../../domain/entities/project.entity';
import type { GoalTarget } from '../../domain/goals/goal';
import { InvalidRangeError } from '../../domain/errors/query.errors';
import { noChannelVisits, TOP_CAMPAIGNS, TOP_SOURCES } from '../../domain/queries/acquisition';
import { FixedClock } from '../../test-utils/fixed-clock';
import { StubAcquisitionQuery } from '../../test-utils/stub-acquisition.query';
import { GetAcquisitionUseCase } from './get-acquisition.usecase';

const PROJECT: Project = {
  id: 'project-1',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: 'signup_completed',
  currency: 'BRL',
  cityEnabled: false,
  visitorsEnabled: false,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};

const SOURCE = {
  source: 'google',
  medium: 'cpc',
  channel: 'paid',
  visits: 4,
  conversions: 3,
  convertingVisits: 2,
  fromAdClickVisits: 3,
  revenue: 389.7,
} as const;

const PAID = {
  channel: 'paid',
  visits: 4,
  conversions: 3,
  convertingVisits: 2,
  fromAdClickVisits: 3,
  revenue: 389.7,
} as const;

const NO_VISITS = {
  visits: 0,
  conversions: 0,
  convertingVisits: 0,
  fromAdClickVisits: 0,
  revenue: 0,
} as const;

const CAMPAIGN = { ...SOURCE, campaign: 'spring_sale', visits: 3 } as const;

function conversionOf(project: Project): GoalTarget | null {
  return project.conversionEvent === null ? null : { type: 'event', name: project.conversionEvent };
}

function setup(project: Project = PROJECT) {
  const query = new StubAcquisitionQuery();
  const useCase = new GetAcquisitionUseCase(
    query,
    new FixedClock(new Date('2026-10-06T02:30:00.000Z')),
  );
  return {
    query,
    run: (from: string, to: string) =>
      useCase.execute(project, { from, to, conversion: conversionOf(project) }),
  };
}

describe('GetAcquisitionUseCase', () => {
  it('fills the channels of every day and hands the sources and campaigns on', async () => {
    const { query, run } = setup();
    query.byDay = [{ date: '2026-10-05', channel: 'paid', visits: 4 }];
    query.bySource = [SOURCE];
    query.byCampaign = [CAMPAIGN];

    const report = await run('2026-10-04', '2026-10-05');

    expect(report.days).toEqual([
      { date: '2026-10-04', byChannel: noChannelVisits() },
      { date: '2026-10-05', byChannel: { ...noChannelVisits(), paid: 4 } },
    ]);
    expect(report.sources).toEqual([SOURCE]);
    expect(report.campaigns).toEqual([CAMPAIGN]);
    expect(report.channels.map(({ channel }) => channel)).toEqual([...CHANNELS]);
    expect(query.limits).toEqual([TOP_SOURCES, TOP_CAMPAIGNS]);
    expect(query.scopes[0]?.range).toEqual({ from: '2026-10-04', to: '2026-10-05' });
  });

  it('gives every channel, in order, zero for those that brought no visit', async () => {
    const { query, run } = setup();
    query.byChannel = [PAID];

    const report = await run('2026-10-05', '2026-10-05');

    expect(report.channels).toEqual(
      CHANNELS.map((channel) => (channel === 'paid' ? PAID : { channel, ...NO_VISITS })),
    );
  });

  it('answers null conversions and revenue without a goal', async () => {
    const { query, run } = setup({ ...PROJECT, conversionEvent: null });
    query.bySource = [SOURCE];
    query.byCampaign = [CAMPAIGN];
    query.byChannel = [PAID];

    const report = await run('2026-10-05', '2026-10-05');
    const uncounted = { conversions: null, convertingVisits: null, revenue: null };

    expect(report.sources).toEqual([{ ...SOURCE, ...uncounted }]);
    expect(report.campaigns).toEqual([{ ...CAMPAIGN, ...uncounted }]);
    expect(report.channels[CHANNELS.indexOf('paid')]).toEqual({ ...PAID, ...uncounted });
  });

  it('counts conversions but no revenue for a page goal', async () => {
    const query = new StubAcquisitionQuery();
    const useCase = new GetAcquisitionUseCase(
      query,
      new FixedClock(new Date('2026-10-06T02:30:00.000Z')),
    );
    query.bySource = [SOURCE];

    const report = await useCase.execute(PROJECT, {
      from: '2026-10-05',
      to: '2026-10-05',
      conversion: { type: 'page', path: '/thanks' },
    });

    expect(report.sources).toEqual([{ ...SOURCE, revenue: null }]);
  });

  it('refuses an invalid range', async () => {
    await expect(setup().run('2026-10-06', '2026-10-06')).rejects.toBeInstanceOf(InvalidRangeError);
  });
});

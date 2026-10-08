import type { Project } from '../../domain/entities/project.entity';
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
} as const;

const CAMPAIGN = { ...SOURCE, campaign: 'spring_sale', visits: 3 } as const;

function setup(project: Project = PROJECT) {
  const query = new StubAcquisitionQuery();
  const useCase = new GetAcquisitionUseCase(
    query,
    new FixedClock(new Date('2026-10-06T02:30:00.000Z')),
  );
  return { query, run: (from: string, to: string) => useCase.execute(project, { from, to }) };
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
    expect(query.limits).toEqual([TOP_SOURCES, TOP_CAMPAIGNS]);
    expect(query.scopes[0]?.range).toEqual({ from: '2026-10-04', to: '2026-10-05' });
  });

  it('answers null conversions without a conversion event', async () => {
    const { query, run } = setup({ ...PROJECT, conversionEvent: null });
    query.bySource = [SOURCE];
    query.byCampaign = [CAMPAIGN];

    const report = await run('2026-10-05', '2026-10-05');

    expect(report.sources).toEqual([{ ...SOURCE, conversions: null, convertingVisits: null }]);
    expect(report.campaigns).toEqual([{ ...CAMPAIGN, conversions: null, convertingVisits: null }]);
  });

  it('refuses an invalid range', async () => {
    await expect(setup().run('2026-10-06', '2026-10-06')).rejects.toBeInstanceOf(InvalidRangeError);
  });
});

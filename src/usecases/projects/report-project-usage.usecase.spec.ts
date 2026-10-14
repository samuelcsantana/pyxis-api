import { InvalidUsageMonthError } from '../../domain/errors/query.errors';
import type { ProjectUsage } from '../../domain/queries/project-usage';
import { FixedClock } from '../../test-utils/fixed-clock';
import { StubProjectUsageQuery } from '../../test-utils/stub-project-usage.query';
import { ReportProjectUsageUseCase } from './report-project-usage.usecase';

const SHOP: ProjectUsage = {
  projectId: 'a9b0c1d2-e3f4-4a5b-8c6d-7e8f9a0b1c2d',
  name: 'Shop',
  events: 1200,
  visits: 340,
};

function setup() {
  const usage = new StubProjectUsageQuery();
  usage.usage = [SHOP];
  const report = new ReportProjectUsageUseCase(
    usage,
    new FixedClock(new Date('2026-10-14T15:00:00.000Z')),
  );
  return { usage, report };
}

describe('ReportProjectUsageUseCase', () => {
  it('reports the current month when none is asked for', async () => {
    const { usage, report } = setup();

    const result = await report.execute({});

    expect(result).toEqual({ month: '2026-10', projects: [SHOP] });
    expect(usage.asked).toEqual([
      { from: new Date('2026-10-01T00:00:00.000Z'), to: new Date('2026-11-01T00:00:00.000Z') },
    ]);
  });

  it('reports the month it is asked for', async () => {
    const { usage, report } = setup();

    const result = await report.execute({ month: '2026-09' });

    expect(result.month).toBe('2026-09');
    expect(usage.asked).toEqual([
      { from: new Date('2026-09-01T00:00:00.000Z'), to: new Date('2026-10-01T00:00:00.000Z') },
    ]);
  });

  it('refuses a malformed month before asking the database', async () => {
    const { usage, report } = setup();

    await expect(report.execute({ month: '2026-9' })).rejects.toBeInstanceOf(
      InvalidUsageMonthError,
    );
    expect(usage.asked).toEqual([]);
  });
});

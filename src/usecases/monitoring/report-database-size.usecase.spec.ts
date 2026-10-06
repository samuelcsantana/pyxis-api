import { Logger } from '@nestjs/common';
import { FixedDatabaseSizeProbe } from '../../test-utils/fixed-database-size.probe';
import { ReportDatabaseSizeUseCase } from './report-database-size.usecase';

describe('ReportDatabaseSizeUseCase', () => {
  it('logs the size, the limit and the ratio the size alarm reads', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    const report = await new ReportDatabaseSizeUseCase(
      new FixedDatabaseSizeProbe(700_000_000),
    ).execute();

    expect(report).toEqual({ bytes: 700_000_000, limitBytes: 1_000_000_000, ratio: 0.7 });
    expect(log).toHaveBeenCalledWith({
      message: 'database.size',
      bytes: 700_000_000,
      limitBytes: 1_000_000_000,
      ratio: 0.7,
    });
  });
});

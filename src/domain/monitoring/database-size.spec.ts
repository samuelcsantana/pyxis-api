import { DATABASE_SIZE_LIMIT_BYTES, databaseSizeReport } from './database-size';

describe('databaseSizeReport', () => {
  it('measures the database against the 1 GB of a free Neon branch', () => {
    expect(DATABASE_SIZE_LIMIT_BYTES).toBe(1_000_000_000);
    expect(databaseSizeReport(712_345_678)).toEqual({
      bytes: 712_345_678,
      limitBytes: 1_000_000_000,
      ratio: 0.7123,
    });
  });

  it('takes another limit when given one', () => {
    expect(databaseSizeReport(50, 200).ratio).toBe(0.25);
  });
});

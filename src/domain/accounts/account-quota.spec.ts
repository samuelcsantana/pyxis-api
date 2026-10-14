import {
  type AccountMonthUsage,
  INGESTION_PAUSE_THRESHOLD,
  ingestionPauseFor,
  isPausedAt,
} from './account-quota';

const MONTH_END = new Date('2026-11-01T00:00:00.000Z');

function usage(events: number, status: AccountMonthUsage['status'] = 'active'): AccountMonthUsage {
  return { accountId: 'acc00000-0000-4000-a000-000000000001', status, events };
}

describe('ingestionPauseFor', () => {
  it('pauses an account at 150% of the plan, until the month ends', () => {
    expect(INGESTION_PAUSE_THRESHOLD).toBe(150_000);
    expect(ingestionPauseFor(usage(150_000), MONTH_END)).toBe(MONTH_END);
    expect(ingestionPauseFor(usage(149_999), MONTH_END)).toBeNull();
  });

  it('never pauses a free account', () => {
    expect(ingestionPauseFor(usage(1_000_000, 'comped'), MONTH_END)).toBeNull();
  });
});

describe('isPausedAt', () => {
  it('holds while the pause lasts and ends at its last instant', () => {
    expect(isPausedAt(MONTH_END, new Date('2026-10-31T23:59:59.999Z'))).toBe(true);
    expect(isPausedAt(MONTH_END, MONTH_END)).toBe(false);
    expect(isPausedAt(null, MONTH_END)).toBe(false);
  });
});

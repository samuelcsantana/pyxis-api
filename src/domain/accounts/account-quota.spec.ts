import {
  type AccountMonthUsage,
  ingestionPauseFor,
  isPausedAt,
  isPauseExemptAt,
} from './account-quota';

const MONTH_END = new Date('2026-11-01T00:00:00.000Z');
const MEASURED_AT = new Date('2026-10-20T03:00:00.000Z');

function usage(events: number, status: AccountMonthUsage['status'] = 'active'): AccountMonthUsage {
  return {
    accountId: 'acc00000-0000-4000-a000-000000000001',
    status,
    events,
    owner: { email: 'owner@example.com', language: 'en' },
    notifiedLevel: 0,
    pauseExemptUntil: null,
    eventsPerMonthLimit: null,
  };
}

describe('ingestionPauseFor', () => {
  it('pauses an account at 150% of the plan, until the month ends', () => {
    expect(ingestionPauseFor(usage(150_000), MONTH_END, MEASURED_AT)).toBe(MONTH_END);
    expect(ingestionPauseFor(usage(149_999), MONTH_END, MEASURED_AT)).toBeNull();
  });

  it('pauses at 150% of the limit set for the account, when one is set', () => {
    const larger = { ...usage(1_499_999), eventsPerMonthLimit: 1_000_000 };

    expect(ingestionPauseFor(larger, MONTH_END, MEASURED_AT)).toBeNull();
    expect(ingestionPauseFor({ ...larger, events: 1_500_000 }, MONTH_END, MEASURED_AT)).toBe(
      MONTH_END,
    );
  });

  it('never pauses a comped account', () => {
    expect(ingestionPauseFor(usage(1_000_000, 'comped'), MONTH_END, MEASURED_AT)).toBeNull();
  });

  it('pauses a free account at its 10,000 events, until the month ends', () => {
    expect(ingestionPauseFor(usage(10_000, 'free'), MONTH_END, MEASURED_AT)).toBe(MONTH_END);
    expect(ingestionPauseFor(usage(9_999, 'free'), MONTH_END, MEASURED_AT)).toBeNull();
  });

  it('pauses a free account at the limit set for it, when one is set', () => {
    const larger = { ...usage(19_999, 'free'), eventsPerMonthLimit: 20_000 };

    expect(ingestionPauseFor(larger, MONTH_END, MEASURED_AT)).toBeNull();
    expect(ingestionPauseFor({ ...larger, events: 20_000 }, MONTH_END, MEASURED_AT)).toBe(
      MONTH_END,
    );
  });

  it('does not pause an exempt account until the exemption is over', () => {
    const exempt = { ...usage(200_000), pauseExemptUntil: new Date('2026-10-25T00:00:00.000Z') };

    expect(ingestionPauseFor(exempt, MONTH_END, MEASURED_AT)).toBeNull();
    expect(ingestionPauseFor(exempt, MONTH_END, new Date('2026-10-25T00:00:00.000Z'))).toBe(
      MONTH_END,
    );
  });
});

describe('isPauseExemptAt', () => {
  it('holds before the end of the exemption and never without one', () => {
    const until = new Date('2026-10-25T00:00:00.000Z');

    expect(isPauseExemptAt(until, new Date('2026-10-24T23:59:59.999Z'))).toBe(true);
    expect(isPauseExemptAt(until, until)).toBe(false);
    expect(isPauseExemptAt(null, until)).toBe(false);
  });
});

describe('isPausedAt', () => {
  it('holds while the pause lasts and ends at its last instant', () => {
    expect(isPausedAt(MONTH_END, new Date('2026-10-31T23:59:59.999Z'))).toBe(true);
    expect(isPausedAt(MONTH_END, MONTH_END)).toBe(false);
    expect(isPausedAt(null, MONTH_END)).toBe(false);
  });
});

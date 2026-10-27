import type { AccountMonthUsage } from './account-quota';
import { quotaLevelOf, quotaNoticeDue } from './quota-notice';

const CONTEXT = {
  notifiedLevel: 0,
  month: '2026-10',
  measuredAt: new Date('2026-10-14T03:00:00.000Z'),
  monthEnd: new Date('2026-11-01T00:00:00.000Z'),
};

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

describe('quotaLevelOf', () => {
  it.each([
    [79_999, 0],
    [80_000, 80],
    [99_999, 80],
    [100_000, 100],
    [149_999, 100],
    [150_000, 150],
  ])('puts %i events at level %i', (events, level) => {
    expect(quotaLevelOf(events, 100_000, 150_000)).toBe(level);
  });
});

describe('quotaLevelOf with a larger plan', () => {
  it.each([
    [799_999, 0],
    [800_000, 80],
    [1_000_000, 100],
    [1_500_000, 150],
  ])('puts %i events at level %i of a million', (events, level) => {
    expect(quotaLevelOf(events, 1_000_000, 1_500_000)).toBe(level);
  });
});

describe('quotaLevelOf on the free plan', () => {
  it.each([
    [7_999, 0],
    [8_000, 80],
    [9_999, 80],
    [10_000, 150],
  ])('puts %i events at level %i, paused at the limit itself', (events, level) => {
    expect(quotaLevelOf(events, 10_000, 10_000)).toBe(level);
  });
});

describe('quotaNoticeDue', () => {
  it('owes nothing below 80%, to a comped account, or for a level already told', () => {
    expect(quotaNoticeDue(usage(79_999), CONTEXT)).toBeNull();
    expect(quotaNoticeDue(usage(200_000, 'comped'), CONTEXT)).toBeNull();
    expect(quotaNoticeDue(usage(85_000), { ...CONTEXT, notifiedLevel: 80 })).toBeNull();
    expect(quotaNoticeDue(usage(85_000), { ...CONTEXT, notifiedLevel: 150 })).toBeNull();
  });

  it('owes the highest level reached, skipping the ones jumped over', () => {
    expect(quotaNoticeDue(usage(160_000), CONTEXT)).toEqual({
      level: 150,
      notice: {
        kind: 'quota_paused',
        events: 160_000,
        limit: 100_000,
        month: '2026-10',
        measuredAt: CONTEXT.measuredAt,
        resumesAt: CONTEXT.monthEnd,
      },
    });
    expect(quotaNoticeDue(usage(120_000), { ...CONTEXT, notifiedLevel: 80 })).toMatchObject({
      level: 100,
      notice: {
        kind: 'quota_warning',
        percent: 100,
        pause: { atEvents: 150_000, until: CONTEXT.monthEnd },
      },
    });
  });

  it('warns an exempt account at 100% with no word of a pause, even past 150%', () => {
    const exempt = { ...usage(160_000), pauseExemptUntil: new Date('2026-12-01T00:00:00.000Z') };

    expect(quotaNoticeDue(exempt, CONTEXT)).toMatchObject({
      level: 100,
      notice: { kind: 'quota_warning', percent: 100, pause: null },
    });
    expect(quotaNoticeDue(exempt, { ...CONTEXT, notifiedLevel: 100 })).toBeNull();
    expect(quotaNoticeDue({ ...exempt, events: 85_000 }, CONTEXT)).toMatchObject({
      level: 80,
      notice: { pause: null },
    });
  });

  it('warns a free account at 80% of its 10,000 events, then pauses it at 10,000', () => {
    expect(quotaNoticeDue(usage(8_000, 'free'), CONTEXT)).toEqual({
      level: 80,
      notice: {
        kind: 'quota_warning',
        percent: 80,
        events: 8_000,
        limit: 10_000,
        month: '2026-10',
        measuredAt: CONTEXT.measuredAt,
        pause: { atEvents: 10_000, until: CONTEXT.monthEnd },
      },
    });
    expect(quotaNoticeDue(usage(10_000, 'free'), { ...CONTEXT, notifiedLevel: 80 })).toEqual({
      level: 150,
      notice: {
        kind: 'quota_paused',
        events: 10_000,
        limit: 10_000,
        month: '2026-10',
        measuredAt: CONTEXT.measuredAt,
        resumesAt: CONTEXT.monthEnd,
      },
    });
    expect(quotaNoticeDue(usage(12_000, 'free'), { ...CONTEXT, notifiedLevel: 150 })).toBeNull();
  });

  it('warns an exempt free account at its limit instead of pausing it', () => {
    const exempt = {
      ...usage(10_000, 'free'),
      pauseExemptUntil: new Date('2026-12-01T00:00:00.000Z'),
    };

    expect(quotaNoticeDue(exempt, CONTEXT)).toMatchObject({
      level: 100,
      notice: { kind: 'quota_warning', percent: 100, limit: 10_000, pause: null },
    });
  });
});

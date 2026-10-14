import type { AccountMonthUsage } from '../../domain/accounts/account-quota';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAccountUsageRepository } from '../../test-utils/in-memory-account-usage.repository';
import { RecordingMailSender } from '../../test-utils/recording-mail-sender';
import { MeasureAccountUsageUseCase } from './measure-account-usage.usecase';

const NOW = new Date('2026-10-14T03:00:00.000Z');
const NOVEMBER_FIRST = new Date('2026-11-01T00:00:00.000Z');
const OVER = 'acc00000-0000-4000-a000-000000000001';
const UNDER = 'acc00000-0000-4000-a000-000000000002';
const FREE = 'acc00000-0000-4000-a000-000000000003';
const NEAR = 'acc00000-0000-4000-a000-000000000004';

function usage(
  accountId: string,
  events: number,
  overrides: Partial<AccountMonthUsage> = {},
): AccountMonthUsage {
  return {
    accountId,
    status: 'active',
    events,
    owner: { email: `${accountId.slice(-1)}@example.com`, language: 'pt-BR' },
    notifiedLevel: 0,
    ...overrides,
  };
}

function setup(measured: readonly AccountMonthUsage[]) {
  const repository = new InMemoryAccountUsageRepository();
  repository.measured = measured;
  const mail = new RecordingMailSender();
  const useCase = new MeasureAccountUsageUseCase(repository, mail, new FixedClock(NOW));
  return { repository, mail, useCase };
}

describe('MeasureAccountUsageUseCase', () => {
  it('records the month so far for every account and pauses only paid ones past 150%', async () => {
    const { repository, useCase } = setup([
      usage(OVER, 160_000),
      usage(UNDER, 50_000, { status: 'trialing' }),
      usage(FREE, 400_000, { status: 'comped' }),
    ]);

    const report = await useCase.execute();

    expect(report).toMatchObject({ month: '2026-10', accounts: 3, paused: 1 });
    expect(repository.windows).toEqual([
      { month: '2026-10', from: new Date('2026-10-01T00:00:00.000Z'), to: NOVEMBER_FIRST },
    ]);
    expect(repository.pauseOf(OVER)).toEqual(NOVEMBER_FIRST);
    expect(repository.pauseOf(UNDER)).toBeNull();
    expect(repository.pauseOf(FREE)).toBeNull();
    expect(await repository.recordedFor(UNDER, '2026-10')).toEqual({
      month: '2026-10',
      events: 50_000,
      updatedAt: NOW,
    });
    expect(await repository.recordedFor(UNDER, '2026-09')).toBeNull();
  });

  it('tells each owner once per level, in their language, and never a free account', async () => {
    const { repository, mail, useCase } = setup([
      usage(OVER, 160_000),
      usage(NEAR, 85_000),
      usage(UNDER, 50_000),
      usage(FREE, 400_000, { status: 'comped' }),
    ]);

    const first = await useCase.execute();
    const second = await useCase.execute();

    expect(first).toMatchObject({ notified: 2, notificationsFailed: 0 });
    expect(second).toMatchObject({ notified: 0, notificationsFailed: 0 });
    expect(mail.quotaNotices).toEqual([
      {
        email: '1@example.com',
        language: 'pt-BR',
        notice: {
          kind: 'quota_paused',
          events: 160_000,
          limit: 100_000,
          month: '2026-10',
          measuredAt: NOW,
          resumesAt: NOVEMBER_FIRST,
        },
      },
      {
        email: '4@example.com',
        language: 'pt-BR',
        notice: {
          kind: 'quota_warning',
          percent: 80,
          events: 85_000,
          limit: 100_000,
          month: '2026-10',
          measuredAt: NOW,
          pauseAtEvents: 150_000,
          pauseUntil: NOVEMBER_FIRST,
        },
      },
    ]);
    expect(repository.notified.get(`${OVER}/2026-10`)).toBe(150);
    expect(repository.notified.get(`${NEAR}/2026-10`)).toBe(80);
  });

  it('tells the next level once the account climbs past it', async () => {
    const { mail, useCase } = setup([usage(NEAR, 101_000, { notifiedLevel: 80 })]);

    await useCase.execute();

    expect(mail.quotaNotices.map(({ notice }) => notice)).toEqual([
      expect.objectContaining({ kind: 'quota_warning', percent: 100 }),
    ]);
  });

  it('keeps going when one e-mail fails, and tells that owner again the next day', async () => {
    const { repository, mail, useCase } = setup([usage(OVER, 160_000), usage(NEAR, 85_000)]);
    mail.failFor('1@example.com', new Error('Resend answered 500'));

    const report = await useCase.execute();

    expect(report).toMatchObject({ notified: 1, notificationsFailed: 1 });
    expect(repository.notified.has(`${OVER}/2026-10`)).toBe(false);
    expect(mail.quotaNotices.map(({ email }) => email)).toEqual(['4@example.com']);
  });

  it('reports nothing measured when there is no account', async () => {
    const { useCase } = setup([]);

    expect(await useCase.execute()).toEqual({
      month: '2026-10',
      accounts: 0,
      paused: 0,
      notified: 0,
      notificationsFailed: 0,
    });
  });
});

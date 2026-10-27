import { Logger } from '@nestjs/common';
import type { FreeAccountToSweep } from '../../domain/repositories/free-account-inactivity.repository';
import { InMemoryAccountLifecycleRepository } from '../../test-utils/in-memory-account-lifecycle.repository';
import { InMemoryFreeAccountInactivityRepository } from '../../test-utils/in-memory-free-account-inactivity.repository';
import { RecordingMailSender } from '../../test-utils/recording-mail-sender';
import { AccountDataDeletion } from './account-data-deletion';
import { SweepInactiveFreeAccountsUseCase } from './sweep-inactive-free-accounts.usecase';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2027-03-01T06:00:00.000Z');
const ACCOUNT_ID = 'acc00000-0000-4000-a000-000000000001';
const OWNER_ID = 'adm00000-0000-4000-a000-000000000001';

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

function freeAccount(fields: Partial<FreeAccountToSweep> = {}): FreeAccountToSweep {
  return {
    accountId: ACCOUNT_ID,
    ownerAdminId: OWNER_ID,
    ownerEmail: 'ana@example.com',
    ownerLanguage: 'pt-BR',
    freeSince: daysAgo(30),
    lastEventAt: null,
    inactivityNotifiedAt: null,
    ...fields,
  };
}

function setup(account: FreeAccountToSweep) {
  const inactivity = new InMemoryFreeAccountInactivityRepository();
  inactivity.add(account);
  const lifecycle = new InMemoryAccountLifecycleRepository();
  lifecycle.add({ accountId: account.accountId, ownerAdminId: OWNER_ID, status: 'free' });
  lifecycle.addProject('shop', account.accountId, 3);
  lifecycle.grant(OWNER_ID, 'shop');
  const mail = new RecordingMailSender();
  const useCase = new SweepInactiveFreeAccountsUseCase(
    inactivity,
    new AccountDataDeletion(lifecycle, mail),
    mail,
  );
  return { inactivity, lifecycle, mail, useCase };
}

const NOTHING = {
  notified: 0,
  revived: 0,
  deleted: 0,
  partlyHeld: 0,
  peopleRemoved: 0,
  failed: [],
};

describe('SweepInactiveFreeAccountsUseCase', () => {
  let error: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('warns the owner of an account empty 30 days after entering the free plan, with the day of deletion', async () => {
    const { inactivity, mail, useCase } = setup(freeAccount());

    expect(await useCase.execute(NOW)).toEqual({ ...NOTHING, notified: 1 });

    expect(mail.accountNotices).toEqual([
      {
        email: 'ana@example.com',
        notice: { kind: 'empty_free_account', deletionOn: new Date('2027-03-08T06:00:00.000Z') },
        language: 'pt-BR',
      },
    ]);
    expect(inactivity.notifiedAt(ACCOUNT_ID)).toEqual(NOW);
  });

  it('warns the owner of an account idle for 90 days with the idle notice', async () => {
    const { mail, useCase } = setup(
      freeAccount({ freeSince: daysAgo(200), lastEventAt: daysAgo(90) }),
    );

    await useCase.execute(NOW);

    expect(mail.accountNotices.map(({ notice }) => notice.kind)).toEqual(['idle_free_account']);
  });

  it('leaves alone an account not yet empty for 30 days nor idle for 90', async () => {
    const empty = setup(freeAccount({ freeSince: daysAgo(29) }));
    const idle = setup(freeAccount({ freeSince: daysAgo(200), lastEventAt: daysAgo(89) }));

    expect(await empty.useCase.execute(NOW)).toEqual(NOTHING);
    expect(await idle.useCase.execute(NOW)).toEqual(NOTHING);
    expect([...empty.mail.accountNotices, ...idle.mail.accountNotices]).toEqual([]);
  });

  it('keeps an account unmarked when the e-mail fails, so the next day tries again', async () => {
    const { inactivity, mail, useCase } = setup(freeAccount());
    mail.failFor('ana@example.com', new Error('provider down'));

    expect(await useCase.execute(NOW)).toEqual(NOTHING);

    expect(inactivity.notifiedAt(ACCOUNT_ID)).toBeNull();
    expect(error).toHaveBeenCalledWith({
      message: 'accounts.notice_failed',
      kind: 'empty_free_account',
      accountId: ACCOUNT_ID,
      reason: 'Error: provider down',
    });
  });

  it('clears the notice of an account that stored an event after it, and deletes nothing', async () => {
    const { inactivity, lifecycle, useCase } = setup(
      freeAccount({ inactivityNotifiedAt: daysAgo(8), lastEventAt: daysAgo(2) }),
    );

    expect(await useCase.execute(NOW)).toEqual({ ...NOTHING, revived: 1 });

    expect(inactivity.notifiedAt(ACCOUNT_ID)).toBeNull();
    expect(lifecycle.account(ACCOUNT_ID)).toBeDefined();
  });

  it('waits the seven days after the notice before deleting', async () => {
    const { lifecycle, useCase } = setup(
      freeAccount({ inactivityNotifiedAt: new Date(NOW.getTime() - 7 * DAY_MS + 1) }),
    );

    expect(await useCase.execute(NOW)).toEqual(NOTHING);
    expect(lifecycle.account(ACCOUNT_ID)).toBeDefined();
  });

  it('deletes the account, its projects and the people left with nothing on the seventh day, and says so', async () => {
    const { lifecycle, mail, useCase } = setup(freeAccount({ inactivityNotifiedAt: daysAgo(7) }));

    expect(await useCase.execute(NOW)).toEqual({ ...NOTHING, deleted: 1, peopleRemoved: 1 });

    expect(lifecycle.account(ACCOUNT_ID)).toBeUndefined();
    expect(lifecycle.hasProject('shop')).toBe(false);
    expect(mail.accountNotices).toEqual([
      { email: 'ana@example.com', notice: { kind: 'account_deleted' }, language: 'pt-BR' },
    ]);
  });

  it('keeps a held project and the account, and reports a failed deletion', async () => {
    const held = setup(freeAccount({ inactivityNotifiedAt: daysAgo(7) }));
    held.lifecycle.holdProject('shop');
    const failing = setup(freeAccount({ inactivityNotifiedAt: daysAgo(7) }));
    failing.lifecycle.failingProjects.add('shop');

    expect(await held.useCase.execute(NOW)).toEqual({ ...NOTHING, partlyHeld: 1 });
    expect(await failing.useCase.execute(NOW)).toEqual({ ...NOTHING, failed: [ACCOUNT_ID] });

    expect(held.lifecycle.hasProject('shop')).toBe(true);
    expect(held.mail.accountNotices).toEqual([]);
  });
});

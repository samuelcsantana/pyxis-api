import { Logger } from '@nestjs/common';
import type { FreeAccountToSweep } from '../../domain/repositories/free-account-inactivity.repository';
import { InMemoryFreeAccountInactivityRepository } from '../../test-utils/in-memory-free-account-inactivity.repository';
import { RecordingMailSender } from '../../test-utils/recording-mail-sender';
import { RemindToInstallUseCase } from './remind-to-install.usecase';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-05T06:00:00.000Z');
const SHOP = { id: 'prj00000-0000-4000-a000-000000000001', name: 'Shop' };

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

function freeAccount(fields: Partial<FreeAccountToSweep> = {}): FreeAccountToSweep {
  return {
    accountId: 'acc-ana',
    ownerAdminId: 'adm-ana',
    ownerEmail: 'ana@example.com',
    ownerLanguage: 'pt-BR',
    freeSince: daysAgo(3),
    lastEventAt: null,
    inactivityNotifiedAt: null,
    installRemindedAt: null,
    oldestProjectWithoutEvents: SHOP,
    ...fields,
  };
}

function setup(...accounts: readonly FreeAccountToSweep[]) {
  const inactivity = new InMemoryFreeAccountInactivityRepository();
  for (const account of accounts) {
    inactivity.add(account);
  }
  const mail = new RecordingMailSender();
  return { inactivity, mail, useCase: new RemindToInstallUseCase(inactivity, mail) };
}

describe('RemindToInstallUseCase', () => {
  let log: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reminds the owner on day three, pointing at the project to install, and records it', async () => {
    const { inactivity, mail, useCase } = setup(freeAccount());

    await expect(useCase.execute(NOW)).resolves.toBe(1);

    expect(mail.installReminders).toEqual([
      { email: 'ana@example.com', reminder: { project: SHOP }, language: 'pt-BR' },
    ]);
    expect(inactivity.installRemindedAt('acc-ana')).toEqual(NOW);
    expect(log).toHaveBeenCalledWith({
      message: 'accounts.install_reminded',
      accountId: 'acc-ana',
    });
  });

  it('reminds an account without a project with no project, so the e-mail asks to create one', async () => {
    const { mail, useCase } = setup(freeAccount({ oldestProjectWithoutEvents: null }));

    await useCase.execute(NOW);

    expect(mail.installReminders.map(({ reminder }) => reminder)).toEqual([{ project: null }]);
  });

  it('leaves alone an account on day two or already on day fourteen', async () => {
    const { mail, useCase } = setup(
      freeAccount({ accountId: 'day-two', freeSince: daysAgo(2) }),
      freeAccount({ accountId: 'day-fourteen', freeSince: daysAgo(14) }),
    );

    await expect(useCase.execute(NOW)).resolves.toBe(0);

    expect(mail.installReminders).toEqual([]);
  });

  it('reminds once only: the next day sends nothing', async () => {
    const { mail, useCase } = setup(freeAccount());

    await useCase.execute(NOW);
    await expect(useCase.execute(new Date(NOW.getTime() + DAY_MS))).resolves.toBe(0);

    expect(mail.installReminders).toHaveLength(1);
  });

  it('leaves alone an account that stored an event or already got the inactivity notice', async () => {
    const { mail, useCase } = setup(
      freeAccount({ accountId: 'measuring', lastEventAt: daysAgo(1) }),
      freeAccount({ accountId: 'warned', inactivityNotifiedAt: daysAgo(1) }),
    );

    await expect(useCase.execute(NOW)).resolves.toBe(0);

    expect(mail.installReminders).toEqual([]);
  });

  it('keeps an account unmarked when the e-mail fails, and still reminds the others', async () => {
    const { inactivity, mail, useCase } = setup(
      freeAccount(),
      freeAccount({ accountId: 'acc-bia', ownerEmail: 'bia@example.com', ownerLanguage: 'es' }),
    );
    mail.failFor('ana@example.com', new Error('provider down'));

    await expect(useCase.execute(NOW)).resolves.toBe(1);

    expect(inactivity.installRemindedAt('acc-ana')).toBeNull();
    expect(inactivity.installRemindedAt('acc-bia')).toEqual(NOW);
    expect(error).toHaveBeenCalledWith({
      message: 'accounts.install_reminder_failed',
      accountId: 'acc-ana',
      reason: 'Error: provider down',
    });
  });
});

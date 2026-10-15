import { Logger } from '@nestjs/common';
import { ACCOUNT_DELETION_BATCH_SIZE } from '../../domain/accounts/account-lifecycle';
import type { BillingSubscription } from '../../domain/billing/billing-gateway';
import { FakeBillingGateway } from '../../test-utils/fake-billing-gateway';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAccountBillingRepository } from '../../test-utils/in-memory-account-billing.repository';
import { InMemoryAccountLifecycleRepository } from '../../test-utils/in-memory-account-lifecycle.repository';
import { InMemoryAccountWelcomeRepository } from '../../test-utils/in-memory-account-welcome.repository';
import { InMemoryProjectlessPeopleRepository } from '../../test-utils/in-memory-projectless-people.repository';
import { RecordingMailSender } from '../../test-utils/recording-mail-sender';
import { SweepProjectlessPeopleUseCase } from '../people/sweep-projectless-people.usecase';
import {
  AccountLifecycleFailedError,
  RunAccountLifecycleUseCase,
} from './run-account-lifecycle.usecase';
import { WelcomeAccountsUseCase } from './welcome-accounts.usecase';

const NOW = new Date('2026-12-01T03:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

function subscription(fields: Partial<BillingSubscription> = {}): BillingSubscription {
  return {
    subscriptionId: 'sub_1',
    customerId: 'cus_1',
    accountId: 'acc-1',
    status: 'active',
    interval: 'month',
    trialEndsAt: null,
    currentPeriodEndsAt: new Date('2026-12-20T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    cardFingerprint: null,
    ...fields,
  };
}

function setup() {
  const lifecycle = new InMemoryAccountLifecycleRepository();
  const billing = new InMemoryAccountBillingRepository();
  const gateway = new FakeBillingGateway();
  const mail = new RecordingMailSender();
  const clock = new FixedClock(NOW);
  const welcomeRepository = new InMemoryAccountWelcomeRepository();
  const welcomes = new WelcomeAccountsUseCase(welcomeRepository, mail, clock, {
    open: true,
    termsVersion: '2026-11-01',
    termsUrl: null,
    dashboardOrigin: 'https://app.example.com',
  });
  const projectless = new InMemoryProjectlessPeopleRepository();
  const useCase = new RunAccountLifecycleUseCase(
    lifecycle,
    billing,
    gateway,
    mail,
    clock,
    welcomes,
    new SweepProjectlessPeopleUseCase(projectless, clock),
  );
  return { lifecycle, billing, gateway, mail, welcomeRepository, projectless, useCase };
}

describe('RunAccountLifecycleUseCase', () => {
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does nothing when no account is due for anything', async () => {
    const { useCase, mail } = setup();

    await expect(useCase.execute()).resolves.toEqual({
      welcomes: 0,
      reconciled: 0,
      statusChanges: 0,
      reconcileFailures: 0,
      keysRevoked: 0,
      endedNotices: 0,
      reminders: 0,
      deleted: 0,
      partlyHeld: 0,
      incompleteRemoved: 0,
      peopleRemoved: 0,
      projectlessMarked: 0,
      projectlessRemoved: 0,
    });
    expect(mail.accountNotices).toEqual([]);
  });

  it('reports the people it marked and removed for having no project left', async () => {
    const { projectless, useCase } = setup();
    projectless.add({ adminUserId: 'taken-off' });
    projectless.add({ adminUserId: 'long-gone', projectlessSince: daysAgo(31) });

    await expect(useCase.execute()).resolves.toMatchObject({
      projectlessMarked: 1,
      projectlessRemoved: 1,
    });
    expect(projectless.person('long-gone')).toBeUndefined();
  });

  it('welcomes the owners the webhook could not, once', async () => {
    const { welcomeRepository, mail, useCase } = setup();
    welcomeRepository.add({
      accountId: 'acc-new',
      ownerEmail: 'ana@example.com',
      ownerLanguage: 'es',
      status: 'active',
      trialEndsAt: new Date('2026-11-15T00:00:00.000Z'),
      termsVersion: '2026-11-01',
    });

    const first = await useCase.execute();
    const second = await useCase.execute();

    expect(first.welcomes).toBe(1);
    expect(second.welcomes).toBe(0);
    expect(mail.welcomes).toEqual([
      { email: 'ana@example.com', welcome: { trialEndsAt: null, terms: null }, language: 'es' },
    ]);
  });

  it('brings each subscribed account in line with Stripe, telling a missed change apart', async () => {
    const { lifecycle, billing, gateway, useCase } = setup();
    lifecycle.add({ accountId: 'acc-1', status: 'active', subscriptionId: 'sub_1' });
    lifecycle.add({ accountId: 'acc-2', status: 'active', subscriptionId: 'sub_2' });
    lifecycle.add({ accountId: 'acc-3', status: 'trialing', subscriptionId: 'sub_gone' });
    lifecycle.add({ accountId: 'acc-4', status: 'comped' });
    gateway.addSubscription(subscription({ status: 'canceled' }));
    gateway.addSubscription(subscription({ subscriptionId: 'sub_2', accountId: 'acc-2' }));

    const report = await useCase.execute();

    expect(report).toMatchObject({ reconciled: 2, statusChanges: 1, reconcileFailures: 1 });
    expect(billing.updates.map(({ accountId, update }) => [accountId, update.status])).toEqual([
      ['acc-1', 'ended'],
      ['acc-2', 'active'],
    ]);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'accounts.reconcile_failed', accountId: 'acc-3' }),
    );
  });

  it("revokes an ended account's keys once its access is over, once", async () => {
    const { lifecycle, useCase } = setup();
    lifecycle.add({ accountId: 'over', status: 'ended', accessEndsAt: daysAgo(1) });
    lifecycle.add({ accountId: 'later', status: 'ended', accessEndsAt: new Date('2026-12-05') });
    lifecycle.addProject('over-shop', 'over', 0, 2);
    lifecycle.addProject('later-shop', 'later', 0, 1);

    const first = await useCase.execute();
    const second = await useCase.execute();

    expect(first.keysRevoked).toBe(1);
    expect(second.keysRevoked).toBe(0);
    expect(lifecycle.liveKeysOf('over-shop')).toBe(0);
    expect(lifecycle.liveKeysOf('later-shop')).toBe(1);
    expect(lifecycle.account('over')?.keysRevokedAt).toEqual(NOW);
  });

  it('tells the owner once that the subscription ended and when the data goes', async () => {
    const { lifecycle, mail, useCase } = setup();
    lifecycle.add({
      accountId: 'over',
      ownerAdminId: 'ana',
      ownerLanguage: 'pt-BR',
      status: 'ended',
      accessEndsAt: daysAgo(2),
    });

    await useCase.execute();
    await useCase.execute();

    expect(mail.accountNotices).toEqual([
      {
        email: 'ana@example.com',
        notice: { kind: 'access_ended', deletionOn: new Date(daysAgo(2).getTime() + 30 * DAY_MS) },
        language: 'pt-BR',
      },
    ]);
  });

  it('tries a notice again the next day when the e-mail fails', async () => {
    const { lifecycle, mail, useCase } = setup();
    lifecycle.add({
      accountId: 'over',
      ownerAdminId: 'ana',
      status: 'ended',
      accessEndsAt: daysAgo(2),
    });
    mail.failFor('ana@example.com', new Error('provider down'));

    const report = await useCase.execute();

    expect(report.endedNotices).toBe(0);
    expect(lifecycle.account('over')?.endedNotifiedAt).toBeNull();
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'accounts.notice_failed', kind: 'access_ended' }),
    );
  });

  it('reminds the owner in the last seven days before the deletion, once', async () => {
    const { lifecycle, mail, useCase } = setup();
    lifecycle.add({
      accountId: 'soon',
      ownerAdminId: 'ana',
      status: 'ended',
      accessEndsAt: daysAgo(24),
      endedNotifiedAt: daysAgo(24),
    });
    lifecycle.add({
      accountId: 'recent',
      ownerAdminId: 'bia',
      status: 'ended',
      accessEndsAt: daysAgo(10),
      endedNotifiedAt: daysAgo(10),
    });

    const first = await useCase.execute();
    const second = await useCase.execute();

    expect(first.reminders).toBe(1);
    expect(second.reminders).toBe(0);
    expect(mail.accountNotices).toEqual([
      {
        email: 'ana@example.com',
        notice: {
          kind: 'deletion_reminder',
          deletionOn: new Date(daysAgo(24).getTime() + 30 * DAY_MS),
        },
        language: 'en',
      },
    ]);
  });

  it('deletes an account thirty days after the end: events in batches, projects, people', async () => {
    const { lifecycle, mail, useCase } = setup();
    lifecycle.add({
      accountId: 'gone',
      ownerAdminId: 'ana',
      status: 'ended',
      accessEndsAt: daysAgo(31),
      endedNotifiedAt: daysAgo(31),
      deletionRemindedAt: daysAgo(7),
    });
    lifecycle.add({ accountId: 'other', ownerAdminId: 'carla', status: 'active' });
    lifecycle.addProject('shop', 'gone', ACCOUNT_DELETION_BATCH_SIZE * 2 + 120);
    lifecycle.addProject('blog', 'gone', 0);
    lifecycle.addProject('elsewhere', 'other', 3);
    lifecycle.grant('ana', 'shop');
    lifecycle.grant('bia', 'shop');
    lifecycle.grant('dora', 'blog');
    lifecycle.grant('dora', 'elsewhere');

    const report = await useCase.execute();

    expect(report).toMatchObject({ deleted: 1, peopleRemoved: 2 });
    expect(lifecycle.account('gone')).toBeUndefined();
    expect(lifecycle.hasProject('shop')).toBe(false);
    expect(lifecycle.hasProject('blog')).toBe(false);
    expect(lifecycle.eventBatches).toEqual([
      ACCOUNT_DELETION_BATCH_SIZE,
      ACCOUNT_DELETION_BATCH_SIZE,
      120,
      0,
    ]);
    expect(lifecycle.hasAdmin('ana')).toBe(false);
    expect(lifecycle.hasAdmin('bia')).toBe(false);
    expect(lifecycle.hasAdmin('dora')).toBe(true);
    expect(lifecycle.hasProject('elsewhere')).toBe(true);
    expect(mail.accountNotices).toEqual([
      { email: 'ana@example.com', notice: { kind: 'account_deleted' }, language: 'en' },
    ]);
  });

  it('keeps a held project and its account, deleting the rest, until the hold is released', async () => {
    const { lifecycle, mail, useCase } = setup();
    lifecycle.add({
      accountId: 'partly-held',
      ownerAdminId: 'ana',
      status: 'ended',
      accessEndsAt: daysAgo(31),
      endedNotifiedAt: daysAgo(31),
      deletionRemindedAt: daysAgo(7),
    });
    lifecycle.addProject('kept', 'partly-held', 4);
    lifecycle.addProject('gone', 'partly-held', 2);
    lifecycle.holdProject('kept');
    lifecycle.grant('ana', 'kept');
    lifecycle.grant('bia', 'gone');
    lifecycle.grant('carla', 'kept');

    const held = await useCase.execute();

    expect(held).toMatchObject({ deleted: 0, partlyHeld: 1, peopleRemoved: 1 });
    expect(lifecycle.hasProject('kept')).toBe(true);
    expect(lifecycle.hasProject('gone')).toBe(false);
    expect(lifecycle.account('partly-held')).toBeDefined();
    expect(lifecycle.hasAdmin('bia')).toBe(false);
    expect(lifecycle.hasAdmin('carla')).toBe(true);
    expect(mail.accountNotices).toEqual([]);

    lifecycle.releaseProject('kept');
    const released = await useCase.execute();

    expect(released).toMatchObject({ deleted: 1, partlyHeld: 0 });
    expect(lifecycle.account('partly-held')).toBeUndefined();
    expect(mail.accountNotices).toEqual([
      { email: 'ana@example.com', notice: { kind: 'account_deleted' }, language: 'en' },
    ]);
  });

  it('neither reminds nor deletes an account whose deletion is held', async () => {
    const { lifecycle, mail, useCase } = setup();
    lifecycle.add({
      accountId: 'held-due',
      ownerAdminId: 'ana',
      status: 'ended',
      accessEndsAt: daysAgo(40),
      endedNotifiedAt: daysAgo(40),
      deletionRemindedAt: daysAgo(16),
      deletionHeldAt: daysAgo(20),
    });
    lifecycle.add({
      accountId: 'held-soon',
      ownerAdminId: 'bia',
      status: 'ended',
      accessEndsAt: daysAgo(24),
      endedNotifiedAt: daysAgo(24),
      deletionHeldAt: daysAgo(2),
    });
    lifecycle.add({
      accountId: 'held-abandoned',
      ownerAdminId: 'carla',
      status: 'incomplete',
      createdAt: daysAgo(10),
      deletionHeldAt: daysAgo(1),
    });

    const report = await useCase.execute();

    expect(report).toMatchObject({ reminders: 0, deleted: 0, incompleteRemoved: 0 });
    expect(lifecycle.account('held-due')).toBeDefined();
    expect(lifecycle.account('held-soon')).toBeDefined();
    expect(lifecycle.account('held-abandoned')).toBeDefined();
    expect(mail.accountNotices).toEqual([]);
  });

  it('keeps the deletion when the last e-mail fails', async () => {
    const { lifecycle, mail, useCase } = setup();
    lifecycle.add({
      accountId: 'gone',
      ownerAdminId: 'ana',
      status: 'ended',
      accessEndsAt: daysAgo(40),
      endedNotifiedAt: daysAgo(40),
      deletionRemindedAt: daysAgo(15),
    });
    mail.failFor('ana@example.com', new Error('provider down'));

    await expect(useCase.execute()).resolves.toMatchObject({ deleted: 1 });
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'accounts.notice_failed', kind: 'account_deleted' }),
    );
  });

  it('goes on with the other accounts when one fails, then fails the run', async () => {
    const { lifecycle, mail, useCase } = setup();
    for (const accountId of ['broken', 'fine']) {
      lifecycle.add({
        accountId,
        status: 'ended',
        accessEndsAt: daysAgo(31),
        endedNotifiedAt: daysAgo(31),
        deletionRemindedAt: daysAgo(7),
      });
      lifecycle.addProject(`${accountId}-shop`, accountId, 10);
    }
    lifecycle.failingProjects.add('broken-shop');

    await expect(useCase.execute()).rejects.toEqual(new AccountLifecycleFailedError(['broken']));
    expect(lifecycle.account('broken')).toBeDefined();
    expect(lifecycle.account('fine')).toBeUndefined();
    expect(mail.accountNotices.map(({ email }) => email)).toEqual(['owner-of-fine@example.com']);
  });

  it('removes accounts that never subscribed after seven days, and their owners if nothing else', async () => {
    const { lifecycle, useCase } = setup();
    lifecycle.add({
      accountId: 'abandoned',
      ownerAdminId: 'ana',
      status: 'incomplete',
      createdAt: daysAgo(8),
    });
    lifecycle.add({
      accountId: 'returning',
      ownerAdminId: 'bia',
      status: 'incomplete',
      createdAt: daysAgo(9),
    });
    lifecycle.add({ accountId: 'paid-before', ownerAdminId: 'bia', status: 'active' });
    lifecycle.add({ accountId: 'fresh', status: 'incomplete', createdAt: daysAgo(3) });
    lifecycle.add({
      accountId: 'paying',
      status: 'incomplete',
      subscriptionId: 'sub_9',
      createdAt: daysAgo(9),
    });

    const report = await useCase.execute();

    expect(report).toMatchObject({ incompleteRemoved: 2, peopleRemoved: 1 });
    expect(lifecycle.account('abandoned')).toBeUndefined();
    expect(lifecycle.account('returning')).toBeUndefined();
    expect(lifecycle.hasAdmin('ana')).toBe(false);
    expect(lifecycle.hasAdmin('bia')).toBe(true);
    expect(lifecycle.account('fresh')).toBeDefined();
    expect(lifecycle.account('paying')).toBeDefined();
  });

  it('fails the run when an abandoned account cannot be removed', async () => {
    const { lifecycle, useCase } = setup();
    lifecycle.add({ accountId: 'stuck', status: 'incomplete', createdAt: daysAgo(8) });
    lifecycle.failingAccounts.add('stuck');

    await expect(useCase.execute()).rejects.toEqual(new AccountLifecycleFailedError(['stuck']));
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'accounts.incomplete_removal_failed',
        accountId: 'stuck',
      }),
    );
  });
});

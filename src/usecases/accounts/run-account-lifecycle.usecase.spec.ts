import { Logger } from '@nestjs/common';
import { ACCOUNT_DELETION_BATCH_SIZE } from '../../domain/accounts/account-lifecycle';
import type { BillingSubscription } from '../../domain/billing/billing-gateway';
import { FakeBillingGateway } from '../../test-utils/fake-billing-gateway';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAccountBillingRepository } from '../../test-utils/in-memory-account-billing.repository';
import { InMemoryAccountLifecycleRepository } from '../../test-utils/in-memory-account-lifecycle.repository';
import { InMemoryAccountRepository } from '../../test-utils/in-memory-account.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { InMemoryAccountWelcomeRepository } from '../../test-utils/in-memory-account-welcome.repository';
import { InMemoryProjectlessPeopleRepository } from '../../test-utils/in-memory-projectless-people.repository';
import { RecordingMailSender } from '../../test-utils/recording-mail-sender';
import { SweepProjectlessPeopleUseCase } from '../people/sweep-projectless-people.usecase';
import {
  AccountLifecycleFailedError,
  RunAccountLifecycleUseCase,
} from './run-account-lifecycle.usecase';
import { ConfirmSubscriptionsUseCase } from '../billing/confirm-subscriptions.usecase';
import { InMemorySubscriptionConfirmationRepository } from '../../test-utils/in-memory-subscription-confirmation.repository';
import { FallBackToFreePlanUseCase } from '../billing/fall-back-to-free-plan.usecase';
import { InMemoryFreePlanFallbackRepository } from '../../test-utils/in-memory-free-plan-fallback.repository';
import { InMemoryFreeAccountInactivityRepository } from '../../test-utils/in-memory-free-account-inactivity.repository';
import { AccountDataDeletion } from './account-data-deletion';
import { SweepInactiveFreeAccountsUseCase } from './sweep-inactive-free-accounts.usecase';
import { ReportSharedFreeSitesUseCase } from './report-shared-free-sites.usecase';
import { InMemoryFreeSiteSharingRepository } from '../../test-utils/in-memory-free-site-sharing.repository';
import { NO_LIMIT_OVERRIDES } from '../../domain/accounts/account-limits';
import { OpenFreePlacesUseCase } from './open-free-places.usecase';
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
    freePlanOpen: false,
    freeAccountsMax: 200,
    trialOffered: true,
    freePlanTermsForEarlierAccountsFrom: null,
  });
  const projectless = new InMemoryProjectlessPeopleRepository();
  const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
  const confirmations = new InMemorySubscriptionConfirmationRepository();
  const fallbacks = new InMemoryFreePlanFallbackRepository();
  const inactivity = new InMemoryFreeAccountInactivityRepository();
  const sharing = new InMemoryFreeSiteSharingRepository();
  const useCase = new RunAccountLifecycleUseCase(
    lifecycle,
    billing,
    gateway,
    mail,
    clock,
    welcomes,
    new SweepProjectlessPeopleUseCase(projectless, clock),
    new OpenFreePlacesUseCase(accounts, { freePlanOpen: true, freeAccountsMax: 1 }),
    new ConfirmSubscriptionsUseCase(confirmations, mail, {
      open: true,
      termsVersion: '2026-11-01',
      termsUrl: null,
      dashboardOrigin: 'https://app.example.com',
      freePlanOpen: false,
      freeAccountsMax: 200,
      trialOffered: true,
      freePlanTermsForEarlierAccountsFrom: null,
    }),
    new FallBackToFreePlanUseCase(fallbacks, mail, new FixedClock(new Date(NOW.getTime() + 1)), {
      open: true,
      termsVersion: '1.3',
      termsUrl: null,
      dashboardOrigin: 'https://app.example.com',
      freePlanOpen: true,
      freeAccountsMax: 200,
      trialOffered: false,
      freePlanTermsForEarlierAccountsFrom: null,
    }),
    new SweepInactiveFreeAccountsUseCase(
      inactivity,
      new AccountDataDeletion(lifecycle, mail),
      mail,
    ),
    new ReportSharedFreeSitesUseCase(sharing),
  );
  return {
    lifecycle,
    billing,
    gateway,
    mail,
    welcomeRepository,
    projectless,
    accounts,
    confirmations,
    fallbacks,
    inactivity,
    sharing,
    useCase,
  };
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
      freePlacesOpened: 0,
      welcomes: 0,
      subscriptionsConfirmed: 0,
      backToFreeNotices: 0,
      reconciled: 0,
      statusChanges: 0,
      reconcileFailures: 0,
      unfitFreeAccountsEnded: 0,
      keysRevoked: 0,
      endedNotices: 0,
      reminders: 0,
      deleted: 0,
      partlyHeld: 0,
      incompleteRemoved: 0,
      inactiveFreeNotices: 0,
      inactiveFreeRevived: 0,
      inactiveFreeDeleted: 0,
      peopleRemoved: 0,
      projectlessMarked: 0,
      projectlessRemoved: 0,
      freeAccountsSharingASite: 0,
    });
    expect(mail.accountNotices).toEqual([]);
  });

  it('reports the free accounts that measure a site another account measures too, after the sweeps', async () => {
    const { sharing, useCase } = setup();
    sharing.overlap({
      accountId: 'acc-free',
      projectId: 'shop',
      origin: 'https://shop.example.com',
      otherProjectId: 'other-shop',
    });

    await expect(useCase.execute()).resolves.toMatchObject({ freeAccountsSharingASite: 1 });
    expect(warn).toHaveBeenCalledWith({
      message: 'accounts.free_site_shared',
      accountId: 'acc-free',
      projectId: 'shop',
      otherProjectIds: ['other-shop'],
    });
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
      eventsPerMonthLimit: null,
      projectsLimit: null,
      peopleLimit: null,
    });

    const first = await useCase.execute();
    const second = await useCase.execute();

    expect(first.welcomes).toBe(1);
    expect(second.welcomes).toBe(0);
    expect(mail.welcomes).toEqual([
      {
        email: 'ana@example.com',
        welcome: { plan: { kind: 'subscription' }, terms: null },
        language: 'es',
      },
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

  it('puts a subscription Stripe ended back on free when it fits, instead of ending it', async () => {
    const { lifecycle, billing, gateway, fallbacks, mail, useCase } = setup();
    lifecycle.add({ accountId: 'acc-1', status: 'ending', subscriptionId: 'sub_1' });
    gateway.addSubscription(subscription({ status: 'canceled' }));
    fallbacks.add({
      accountId: 'acc-1',
      ownerEmail: 'ana@example.com',
      ownerLanguage: 'es',
      eventsPerMonthLimit: null,
      status: 'ending',
      fit: {
        ...NO_LIMIT_OVERRIDES,
        projects: 1,
        people: 1,
        acceptedTermsVersions: ['1.3'],
        ownerHasAnotherFreeAccount: false,
      },
    });

    const report = await useCase.execute();

    expect(report).toMatchObject({ reconciled: 1, statusChanges: 1, backToFreeNotices: 0 });
    expect(billing.updates).toEqual([]);
    expect(fallbacks.statusOf('acc-1')).toBe('free');
    expect(mail.accountNotices).toEqual([
      {
        email: 'ana@example.com',
        notice: { kind: 'back_to_free', eventsPerMonth: 10_000 },
        language: 'es',
      },
    ]);
    expect(warn).toHaveBeenCalledWith({
      message: 'accounts.reconciled_status',
      accountId: 'acc-1',
      from: 'ending',
      to: 'free',
    });
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

  it('opens the free places left before welcoming, so a newly opened account is welcomed the same day', async () => {
    const { accounts, useCase } = setup();
    const account = await accounts.create({ ownerAdminId: 'waiting', status: 'incomplete' });
    accounts.add({ ...account, freeWaitlistedAt: daysAgo(2) });

    const report = await useCase.execute();

    expect(report.freePlacesOpened).toBe(1);
    expect(accounts.stored[0]?.status).toBe('free');
  });

  it('ends a free account still over its limits on its deadline, before revoking the keys of the ended', async () => {
    const { lifecycle, fallbacks, useCase } = setup();
    fallbacks.add({
      accountId: 'too-big',
      ownerEmail: 'ana@example.com',
      ownerLanguage: 'es',
      eventsPerMonthLimit: null,
      status: 'free',
      fit: {
        ...NO_LIMIT_OVERRIDES,
        projects: 2,
        people: 1,
        acceptedTermsVersions: ['1.3'],
        ownerHasAnotherFreeAccount: false,
      },
    });
    fallbacks.setFitDeadline('too-big', NOW);
    const end = jest.spyOn(fallbacks, 'endUnfit');
    const revoke = jest.spyOn(lifecycle, 'revokeKeysOfEndedAccounts');

    const report = await useCase.execute();

    expect(report.unfitFreeAccountsEnded).toBe(1);
    expect(fallbacks.ended).toEqual([{ accountId: 'too-big', at: NOW }]);
    expect(end.mock.invocationCallOrder[0]).toBeLessThan(
      revoke.mock.invocationCallOrder[0] ?? Number.NaN,
    );
  });

  it('sweeps the free accounts with no events, adding its deletions and failures to the run', async () => {
    const { lifecycle, inactivity, mail, useCase } = setup();
    const owner = {
      ownerEmail: 'ana@example.com',
      ownerLanguage: 'en' as const,
      lastEventAt: null,
    };
    inactivity.add({
      ...owner,
      accountId: 'empty',
      ownerAdminId: 'empty-owner',
      freeSince: daysAgo(30),
      inactivityNotifiedAt: null,
    });
    inactivity.add({
      ...owner,
      accountId: 'warned',
      ownerAdminId: 'warned-owner',
      freeSince: daysAgo(60),
      inactivityNotifiedAt: daysAgo(7),
    });
    inactivity.add({
      ...owner,
      accountId: 'stuck',
      ownerAdminId: 'stuck-owner',
      freeSince: daysAgo(60),
      inactivityNotifiedAt: daysAgo(7),
    });
    lifecycle.add({ accountId: 'warned', ownerAdminId: 'warned-owner', status: 'free' });
    lifecycle.add({ accountId: 'stuck', ownerAdminId: 'stuck-owner', status: 'free' });
    lifecycle.failingAccounts.add('stuck');

    await expect(useCase.execute()).rejects.toEqual(new AccountLifecycleFailedError(['stuck']));

    expect(lifecycle.account('warned')).toBeUndefined();
    expect(mail.accountNotices.map(({ notice }) => notice.kind).sort()).toEqual([
      'account_deleted',
      'empty_free_account',
    ]);
  });

  it('sends the back-to-free notices the webhook could not', async () => {
    const { fallbacks, mail, useCase } = setup();
    fallbacks.add({
      accountId: 'fell-back',
      ownerEmail: 'bia@example.com',
      ownerLanguage: 'en',
      eventsPerMonthLimit: null,
      status: 'active',
      fit: {
        ...NO_LIMIT_OVERRIDES,
        projects: 0,
        people: 0,
        acceptedTermsVersions: ['1.3'],
        ownerHasAnotherFreeAccount: false,
      },
    });
    await fallbacks.fallBack('fell-back', NOW);

    const report = await useCase.execute();

    expect(report.backToFreeNotices).toBe(1);
    expect(mail.accountNotices.map(({ notice }) => notice.kind)).toEqual(['back_to_free']);
  });

  it('sends the subscription confirmations the webhook could not', async () => {
    const { confirmations, mail, useCase } = setup();
    confirmations.add({
      accountId: 'paying',
      ownerEmail: 'ana@example.com',
      ownerLanguage: 'es',
      billingInterval: 'year',
      termsVersion: null,
    });

    const report = await useCase.execute();

    expect(report.subscriptionsConfirmed).toBe(1);
    expect(mail.subscriptionConfirmations).toEqual([
      {
        email: 'ana@example.com',
        confirmation: { interval: 'year', withdrawalDays: 7, terms: null },
        language: 'es',
      },
    ]);
  });

  it('keeps a sign-up waiting for a free place for sixty days from when it started waiting', async () => {
    const { lifecycle, useCase } = setup();
    lifecycle.add({
      accountId: 'waiting',
      status: 'incomplete',
      createdAt: daysAgo(30),
      freeWaitlistedAt: daysAgo(30),
    });
    lifecycle.add({
      accountId: 'gave-up',
      status: 'incomplete',
      createdAt: daysAgo(90),
      freeWaitlistedAt: daysAgo(61),
    });

    const report = await useCase.execute();

    expect(report).toMatchObject({ incompleteRemoved: 1 });
    expect(lifecycle.account('waiting')).toBeDefined();
    expect(lifecycle.account('gave-up')).toBeUndefined();
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

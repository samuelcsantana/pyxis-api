import { Logger } from '@nestjs/common';
import type { BillingEvent, BillingSubscription } from '../../domain/billing/billing-gateway';
import {
  BillingUnavailableError,
  InvalidBillingSignatureError,
} from '../../domain/errors/billing.errors';
import { FakeBillingGateway } from '../../test-utils/fake-billing-gateway';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAccountWelcomeRepository } from '../../test-utils/in-memory-account-welcome.repository';
import { RecordingMailSender } from '../../test-utils/recording-mail-sender';
import { WelcomeAccountsUseCase } from '../accounts/welcome-accounts.usecase';
import {
  InMemoryAccountBillingRepository,
  InMemoryBillingEventRepository,
} from '../../test-utils/in-memory-account-billing.repository';
import { InMemoryTrialCardRepository } from '../../test-utils/in-memory-trial-card.repository';
import { DetectRepeatedTrialUseCase } from './detect-repeated-trial.usecase';
import { HandleBillingEventUseCase } from './handle-billing-event.usecase';

const NOW = new Date('2026-10-20T12:00:00.000Z');
const ACCOUNT_ID = 'acc00000-0000-4000-a000-000000000001';
const TRIAL_END = new Date('2026-11-03T12:00:00.000Z');
const COMMAND = { rawBody: Buffer.from('{}'), signature: 't=1,v1=x' };

const TRIALING: BillingSubscription = {
  subscriptionId: 'sub_1',
  customerId: 'cus_1',
  accountId: ACCOUNT_ID,
  status: 'trialing',
  interval: 'year',
  trialEndsAt: TRIAL_END,
  currentPeriodEndsAt: TRIAL_END,
  cancelAtPeriodEnd: false,
  cardFingerprint: null,
};

function event(overrides: Partial<BillingEvent> = {}): BillingEvent {
  return {
    id: 'evt_1',
    type: 'checkout.session.completed',
    subscriptionId: 'sub_1',
    customerId: 'cus_1',
    accountId: ACCOUNT_ID,
    ...overrides,
  };
}

function setup(before: 'incomplete' | 'active' | 'free' = 'incomplete') {
  const gateway = new FakeBillingGateway();
  const events = new InMemoryBillingEventRepository();
  const accounts = new InMemoryAccountBillingRepository();
  accounts.add({
    accountId: ACCOUNT_ID,
    status: before,
    accessEndsAt: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  });
  const clock = new FixedClock(NOW);
  const welcomeRepository = new InMemoryAccountWelcomeRepository();
  welcomeRepository.add({
    accountId: ACCOUNT_ID,
    ownerEmail: 'owner@example.com',
    ownerLanguage: 'pt-BR',
    status: 'trialing',
    trialEndsAt: TRIAL_END,
    termsVersion: '2026-11-01',
    eventsPerMonthLimit: null,
    projectsLimit: null,
    peopleLimit: null,
  });
  const mail = new RecordingMailSender();
  const welcomes = new WelcomeAccountsUseCase(welcomeRepository, mail, clock, {
    open: true,
    termsVersion: '2026-11-01',
    termsUrl: 'https://example.com/termos',
    dashboardOrigin: 'https://app.example.com',
    freePlanOpen: false,
    freeAccountsMax: 200,
    trialOffered: true,
  });
  const trialCards = new InMemoryTrialCardRepository();
  const useCase = new HandleBillingEventUseCase(
    gateway,
    events,
    accounts,
    clock,
    welcomes,
    new DetectRepeatedTrialUseCase(trialCards, clock),
  );
  return { gateway, events, accounts, mail, trialCards, useCase };
}

describe('HandleBillingEventUseCase', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('re-reads the subscription and puts its state on the account named by Checkout', async () => {
    const { gateway, accounts, useCase } = setup();
    gateway.addSubscription(TRIALING);
    gateway.willReceive(event());

    expect(await useCase.execute(COMMAND)).toBe('applied');

    expect(gateway.subscriptionReads).toEqual(['sub_1']);
    expect(accounts.updates).toEqual([
      {
        accountId: ACCOUNT_ID,
        update: {
          status: 'trialing',
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: 'sub_1',
          billingInterval: 'year',
          trialEndsAt: TRIAL_END,
          currentPeriodEndsAt: TRIAL_END,
          accessEndsAt: null,
          restoresAccess: true,
          leavesFreePlanInMonth: null,
        },
      },
    ]);
  });

  it('moves a free account onto the paid plan, naming the month to clear, with no new welcome', async () => {
    const { gateway, accounts, mail, useCase } = setup('free');
    gateway.addSubscription({ ...TRIALING, status: 'active', trialEndsAt: null });
    gateway.willReceive(event());

    expect(await useCase.execute(COMMAND)).toBe('applied');

    expect(accounts.updates[0]?.update).toMatchObject({
      status: 'active',
      leavesFreePlanInMonth: NOW.toISOString().slice(0, 7),
    });
    expect(mail.welcomes).toEqual([]);
  });

  it('keeps a free account free when its subscription ended or never ran, and completes the event', async () => {
    const { gateway, accounts, trialCards, useCase } = setup('free');
    gateway.addSubscription({ ...TRIALING, status: 'canceled', cardFingerprint: 'fp_1' });
    gateway.willReceive(event());

    expect(await useCase.execute(COMMAND)).toBe('ignored');
    gateway.willReceive(event());
    expect(await useCase.execute(COMMAND)).toBe('duplicate');

    expect(accounts.updates).toEqual([]);
    expect(accounts.stored(ACCOUNT_ID)?.status).toBe('free');
    expect(trialCards.cards).toEqual([]);
  });

  it('welcomes the owner when the account gains access for the first time', async () => {
    const { gateway, mail, useCase } = setup();
    gateway.addSubscription(TRIALING);
    gateway.willReceive(event());

    await useCase.execute(COMMAND);

    expect(mail.welcomes).toEqual([
      {
        email: 'owner@example.com',
        welcome: {
          plan: { kind: 'trial', trialEndsAt: TRIAL_END },
          terms: { version: '2026-11-01', url: 'https://example.com/termos' },
        },
        language: 'pt-BR',
      },
    ]);
  });

  it('sends no welcome to an account that already had access, nor for an end', async () => {
    const running = setup('active');
    running.gateway.addSubscription(TRIALING);
    running.gateway.willReceive(event());
    const ending = setup();
    ending.gateway.addSubscription({ ...TRIALING, status: 'canceled' });
    ending.gateway.willReceive(event());

    await running.useCase.execute(COMMAND);
    await ending.useCase.execute(COMMAND);

    expect(running.mail.welcomes).toEqual([]);
    expect(ending.mail.welcomes).toEqual([]);
  });

  it('applies an event once, however many times Stripe sends it', async () => {
    const { gateway, accounts, useCase } = setup();
    gateway.addSubscription(TRIALING);
    gateway.willReceive(event());

    await useCase.execute(COMMAND);

    expect(await useCase.execute(COMMAND)).toBe('duplicate');
    expect(accounts.updates).toHaveLength(1);
  });

  it('finds the account by the subscription when the event does not name it', async () => {
    const { gateway, accounts, useCase } = setup();
    gateway.addSubscription(TRIALING);
    gateway.willReceive(event({ type: 'checkout.session.completed' }));
    await useCase.execute(COMMAND);
    gateway.addSubscription({ ...TRIALING, accountId: null, status: 'past_due' });
    gateway.willReceive(event({ id: 'evt_2', type: 'invoice.payment_failed', accountId: null }));

    expect(await useCase.execute(COMMAND)).toBe('applied');
    expect(accounts.stored(ACCOUNT_ID)?.status).toBe('past_due');
  });

  it('ignores an event without a subscription, and remembers it', async () => {
    const { gateway, events, accounts, useCase } = setup();
    gateway.willReceive(event({ type: 'customer.created', subscriptionId: null }));

    expect(await useCase.execute(COMMAND)).toBe('ignored');
    expect(await useCase.execute(COMMAND)).toBe('duplicate');
    expect(events.claimed).toEqual(['evt_1', 'evt_1']);
    expect(accounts.updates).toEqual([]);
  });

  it('ignores, with a warning, a subscription no account owns', async () => {
    const warnings: unknown[] = [];
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => {
      warnings.push(message);
    });
    const { gateway, accounts, useCase } = setup();
    gateway.addSubscription({
      ...TRIALING,
      subscriptionId: 'sub_9',
      accountId: null,
      customerId: 'cus_9',
    });
    gateway.willReceive(event({ subscriptionId: 'sub_9', customerId: 'cus_9', accountId: null }));

    expect(await useCase.execute(COMMAND)).toBe('ignored');
    expect(accounts.updates).toEqual([]);
    expect(warnings).toEqual([
      {
        message: 'billing.event_without_account',
        eventId: 'evt_1',
        type: 'checkout.session.completed',
      },
    ]);
  });

  it('leaves the event to Stripe’s retry when the subscription cannot be read', async () => {
    const { gateway, events, useCase } = setup();
    gateway.willReceive(event());

    await expect(useCase.execute(COMMAND)).rejects.toBeInstanceOf(BillingUnavailableError);

    gateway.addSubscription(TRIALING);
    expect(await useCase.execute(COMMAND)).toBe('applied');
    expect(events.claimed).toEqual(['evt_1', 'evt_1']);
  });

  it('refuses an event that is not signed by Stripe, before touching anything', async () => {
    const { events, useCase } = setup();

    await expect(useCase.execute(COMMAND)).rejects.toBeInstanceOf(InvalidBillingSignatureError);
    expect(events.claimed).toEqual([]);
  });

  it('records the card of a trial, and only for an applied event', async () => {
    const { gateway, trialCards, useCase } = setup();
    gateway.addSubscription({ ...TRIALING, cardFingerprint: 'fp_card_1' });
    gateway.willReceive(event());

    await useCase.execute(COMMAND);
    await useCase.execute(COMMAND);

    expect(trialCards.cards).toEqual([
      { fingerprint: 'fp_card_1', accountId: ACCOUNT_ID, trialStartedAt: NOW },
    ]);
  });
});
